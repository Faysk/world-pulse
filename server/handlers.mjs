import {
  ApiError, onlyMethod, parseBody, readSessionCookie,
  requireSameOrigin, json, fail, normalizeHashtag, validateTagId, validateTapBatch, tokenHash
} from './protocol.mjs';
import * as store from './store.mjs';
import { countryEstimateForRequest } from './geoPrivacy.mjs';
import {regionCenter} from './regionGrid.mjs';

function setSessionCookie(res, token, expiresAt) {
  const base=2592000;
  const requested=expiresAt ? Math.ceil((new Date(expiresAt).getTime()-Date.now())/1000) : base;
  const maxAge=Number.isFinite(requested) ? Math.max(base,Math.min(34560000,requested)) : base;
  const secure=process.env.NODE_ENV === 'development' ? '' : '; Secure';
  res.setHeader('Set-Cookie','wp_session='+token+'; HttpOnly; Path=/; SameSite=Lax; Max-Age='+maxAge+secure);
}

export function route(kind, operations = store) {
  const {
    findVisitor, createVisitor, requireVisitor, createOrGetTag,
    selectTag, creditBatch, getCredits, getRanking, getActiveBalanceSnapshot, consumeApiBudget,setCountryConsent,getCountrySnapshot,setRegionCell,getRegionSnapshot
  } = operations;
  return async function handler(req, res) {
    try {
      // Default OFF even after the code lands in main. Enable only after
      // migration, retention, security and privacy gates are approved.
      if (process.env.WP_API_ENABLED !== 'true') {
        throw new ApiError(503, 'participation_disabled', 'Participação real ainda não foi liberada.');
      }
      if (kind === 'history') {
        onlyMethod(req, 'GET');
        await consumeApiBudget();
        await consumeApiBudget('reads');
        const ranking = await getRanking();
        return json(res, 200, { type: 'historical', ranking });
      }
      if(kind==='countries'){
        onlyMethod(req,'GET');
        if(process.env.WP_GEO_PUBLIC_ENABLED!=='true')throw new ApiError(503,'geography_disabled','Origem geográfica ainda não liberada.');
        await consumeApiBudget();await consumeApiBudget('reads');
        return json(res,200,await getCountrySnapshot());
      }
      if(kind==='regions'){
        onlyMethod(req,'GET');
        if(process.env.WP_GEO_PUBLIC_ENABLED!=='true')throw new ApiError(503,'geography_disabled','Mapa regional indisponível.');
        await consumeApiBudget();await consumeApiBudget('reads');
        return json(res,200,await getRegionSnapshot());
      }
      if (kind === 'activity' || kind === 'ranking') {
        onlyMethod(req, 'GET');
        await consumeApiBudget();
        await consumeApiBudget('reads');
        // Public aggregate contains no individual session identifiers or
        // coordinates. Remains disabled by WP_API_ENABLED by default.
        return json(res, 200, await getActiveBalanceSnapshot());
      }

      onlyMethod(req, 'POST');
      requireSameOrigin(req);
      const body = parseBody(req);
      await consumeApiBudget();
      const token = readSessionCookie(req);
      const country=countryEstimateForRequest(req);

      if (kind === 'session') {
        if('geoConsent'in body&&typeof body.geoConsent!=='boolean')throw new ApiError(400,'invalid_geo_consent','Escolha de país inválida.');
        const existing = await findVisitor(token,country);
        let newToken = null;
        if (!existing) {
          const created = await createVisitor();
          newToken = created.token;
        }
        let visitor = existing ?? await requireVisitor(newToken,country);
        if(typeof body.geoConsent==='boolean'){
          await setCountryConsent(visitor.id,body.geoConsent,country);
          visitor=await requireVisitor(newToken??token,country);
        }
        const sessionToken = newToken ?? token;
        if (sessionToken) {
          setSessionCookie(res,sessionToken,visitor.expires_at);
        }
        const credits=await getCredits(visitor.id);
        return json(res, 200, {
          anonymous: true,
          sessionFresh: !existing,
          geoConsent:visitor.country_consent===true,
          geoConsentDecided:visitor.country_consent_at!=null,
          geoCountry:visitor.country_consent===true?visitor.country_code:'ZZ',
          geographyAvailable:process.env.WP_GEO_PUBLIC_ENABLED==='true',
          regionCell:visitor.region_cell??null,
          // Stable non-authenticating queue marker derived from a 256-bit random
          // HttpOnly cookie. It is only returned to the same-origin client;
          // the backend NEVER accepts it as proof of identity.
          sessionBinding: tokenHash('world-pulse-queue-binding-v1:' + (newToken ?? token)),
          activeTagId: visitor.active_tag_id ?? null,
          activeTag: visitor.active_tag_id && visitor.active_tag_name
            ? { id: visitor.active_tag_id, name: '#' + visitor.active_tag_name, color: visitor.active_tag_color }
            : null,
          credits: credits.slice(0,200),
          creditsHasMore:credits.length>200
        });
      }

      const visitor = await requireVisitor(token,country);
      if(kind==='location'){
        if(process.env.WP_GEO_PUBLIC_ENABLED!=='true'&&body.cell!==null)throw new ApiError(503,'geography_disabled','Mapa regional indisponível.');
        if(req.headers?.['x-wp-session-binding']!==tokenHash('world-pulse-queue-binding-v1:'+token))throw new ApiError(409,'session_binding_mismatch','A sessão mudou. Recarregue antes de compartilhar a região.');
        if(Object.keys(body).some(key=>key!=='cell')||!('cell'in body))throw new ApiError(400,'invalid_region_cell','Envie somente a célula regional.');
        try{if(body.cell!==null)regionCenter(body.cell);}catch{throw new ApiError(400,'invalid_region_cell','Célula regional inválida.');}
        await setRegionCell(visitor.id,body.cell,country);
        return json(res,200,{regionCell:body.cell,geoConsent:body.cell!==null,geoCountry:body.cell!==null?country:'ZZ'});
      }
      if (kind === 'tags') {
        if (typeof body.name !== 'string') throw new ApiError(400,'invalid_hashtag','Nome obrigatório.');
        normalizeHashtag(body.name);
        return json(res, 200, { tag: await createOrGetTag(body.name) });
      }
      if (kind === 'select') {
        const tagId = body.tagId === null ? null : validateTagId(body.tagId);
        const selection=await selectTag(visitor.id, tagId);
        const credits=await getCredits(visitor.id);
        return json(res, 200, {...selection,credits:credits.slice(0,200),creditsHasMore:credits.length>200});
      }
      if (kind === 'taps') {
        // The cookie can rotate in ANOTHER TAB after a session check and
        // before this request. Bind the batch to the cookie at THIS request.
        // The marker is not authentication; the HttpOnly cookie still is.
        const binding = req.headers?.['x-wp-session-binding'];
        const expected = tokenHash('world-pulse-queue-binding-v1:' + token);
        if (typeof binding !== 'string' || binding !== expected) {
          throw new ApiError(409, 'session_binding_mismatch',
            'Lote vinculado a outra sessão anônima.');
        }
        const credit=await creditBatch(visitor.id, validateTapBatch(body));
        // Refresh the same credential after extending a long balance. Its
        // expiry must not silently cut off return before that balance ends.
        if (token) setSessionCookie(res,token,(await requireVisitor(token,country)).expires_at);
        return json(res, 200, credit);
      }
      throw new ApiError(404,'not_found','Rota inexistente.');
    } catch (error) {
      return fail(res, error);
    }
  };
}
