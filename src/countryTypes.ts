export type CountrySnapshot={type:'country_snapshot';asOfMs:number;validUntilMs:number;granularity:'country';privacyThreshold:5;
  tags:Array<{id:string;name:string;color:string;activeParticipants:string;countries:Array<{countryCode:string;activeParticipants:string}>}>};
