import {
  ApiError, onlyMethod, parseBody, readSessionCookie,
  requireSameOrigin, json, fail, normalizeHashtag, validateTagId, validateTapBatch
} from './protocol.mjs';
import * as store from './store.mjs';

export function route(kind, operations = store) {
  const {
    findVisitor, createVisitor, requireVisitor, createOrGetTag,
    selectTag, creditBatch, getCredits, getRanking
  } = operations;
  return async function handler(req, res) {
    try {
      // Default OFF even after the code lands in main. Enable only after
      // migration, retention, security and privacy gates are approved.
      if (process.env.WP_API_ENABLED !== 'true') {
        throw new ApiError(503, 'participation_disabled', 'Participação real ainda não foi liberada.');
      }
      if (kind === 'ranking') {
        onlyMethod(req, 'GET');
        const ranking = await getRanking();
        return json(res, 200, { type: 'historical', ranking });
      }

      onlyMethod(req, 'POST');
      requireSameOrigin(req);
      const body = parseBody(req);
      const token = readSessionCookie(req);

      if (kind === 'session') {
        const existing = await findVisitor(token);
        let newToken = null;
        if (!existing) {
          const created = await createVisitor();
          newToken = created.token;
        }
        const visitor = existing ?? await requireVisitor(newToken);
        if (newToken) {
          const secure = process.env.NODE_ENV === 'development' ? '' : '; Secure';
          res.setHeader('Set-Cookie',
            'wp_session=' + newToken + '; HttpOnly; Path=/; SameSite=Lax; Max-Age=2592000' + secure);
        }
        return json(res, 200, {
          anonymous: true,
          activeTagId: visitor.active_tag_id ?? null,
          credits: await getCredits(visitor.id)
        });
      }

      const visitor = await requireVisitor(token);
      if (kind === 'tags') {
        if (typeof body.name !== 'string') throw new ApiError(400,'invalid_hashtag','Nome obrigatório.');
        normalizeHashtag(body.name);
        return json(res, 200, { tag: await createOrGetTag(body.name) });
      }
      if (kind === 'select') {
        const tagId = body.tagId === null ? null : validateTagId(body.tagId);
        return json(res, 200, await selectTag(visitor.id, tagId));
      }
      if (kind === 'taps') {
        return json(res, 200, await creditBatch(visitor.id, validateTapBatch(body)));
      }
      throw new ApiError(404,'not_found','Rota inexistente.');
    } catch (error) {
      return fail(res, error);
    }
  };
}
