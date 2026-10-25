export type RegionRow={cell:string;tagId:string;name:string;color:string;participants:string};
export type RegionSnapshot={type:'region_snapshot';asOfMs:number;validUntilMs:number;cells:RegionRow[]};
