// Legacy flat-map helpers retained for island compatibility. The live globe uses
// exact sourced building pins from atlas.json, not MAP_POINTS or flat polygons.
export const MAP_POINTS={1:[5,-35],2:[-5,-2],3:[12,-48],4:[-65,-29],5:[-6,-25],6:[-66,-10],7:[32,-64],8:[-43,-28],9:[-35,-13],10:[24,-8],11:[78,-32],12:[42,-28],13:[-89,-10],14:[-16,-50],15:[25,-37],16:[-22,-10],17:[78,-9],18:[92,-46],19:[0,-55],20:[106,-29],21:[103,-12],22:[90,5],23:[-47,3],24:[40,-10],25:[17,-23]};
export const mapPoint=id=>{const p=MAP_POINTS[id];return p?{x:p[0],z:p[1]}:{x:0,z:0};};
export const EMPTY_ISLANDS=[
 {id:'south-america',name:'南美洲・無人島',x:-57,z:40,r:5.1,description:'本次 25 件代表作品沒有涵蓋南美洲；不表示當地沒有重要建築或建築師。'},
 {id:'africa',name:'非洲・無人島',x:8,z:34,r:5.2,description:'本次 25 件代表作品沒有涵蓋非洲；這只是典藏範圍，不是建築文化的空白。'},
 {id:'mainland-asia',name:'亞洲大陸・無人島',x:54,z:18,r:4.4,description:'本次 25 件代表作品在亞洲涵蓋日本與臺灣，未涵蓋亞洲大陸；不表示當地沒有重要建築師。'},
 {id:'oceania',name:'大洋洲・無人島',x:94,z:48,r:5.2,description:'本次 25 件代表作品沒有涵蓋大洋洲；不表示當地沒有重要建築或建築師。'}
];
export const CONTINENTS=[
 {name:'北美洲',english:'NORTH AMERICA',label:[-77,-54],points:[[-112,-63],[-90,-69],[-70,-63],[-47,-56],[-36,-39],[-31,-22],[-40,-5],[-52,12],[-59,5],[-68,-2],[-82,-3],[-96,-17],[-105,-36]]},
 {name:'南美洲',english:'SOUTH AMERICA',label:[-51,63],points:[[-67,19],[-53,16],[-38,27],[-40,44],[-49,62],[-59,71],[-62,51],[-72,35]]},
 {name:'歐洲',english:'EUROPE · EXPANDED',label:[12,-77],points:[[-30,-55],[-18,-62],[-8,-59],[1,-66],[17,-60],[23,-75],[36,-79],[46,-61],[44,-39],[53,-30],[47,-13],[31,-1],[12,-9],[-1,5],[-27,3],[-30,-18],[-17,-33]]},
 {name:'非洲',english:'AFRICA',label:[8,59],points:[[-25,13],[-9,7],[14,9],[31,20],[36,32],[24,45],[13,64],[4,57],[-1,41],[-13,39],[-25,25]]},
 {name:'亞洲',english:'ASIA',label:[63,-63],points:[[42,-61],[58,-72],[87,-67],[116,-60],[111,-44],[94,-32],[75,-20],[85,-4],[68,6],[60,26],[51,22],[42,3],[28,-1],[38,-21]]},
 {name:'日本群島',english:'JAPAN · EXPANDED',label:[96,-60],points:[[91,-55],[99,-48],[111,-37],[114,-24],[109,-8],[96,13],[84,10],[71,-4],[72,-23],[77,-42]]},
 {name:'大洋洲',english:'OCEANIA',label:[93,68],points:[[76,39],[89,32],[102,36],[110,48],[104,59],[89,61],[77,55]]}
];
export const EDGE_TYPES={mentorship:{label:'授業／師承',color:'#9c632c',dash:'',description:'機構史料明確記載的授業關係'},employment:{label:'任職／共事',color:'#51766e',dash:'',description:'有來源可查的事務所工作關係，不自動等同師承'},thematic:{label:'理念對讀',color:'#8b7099',dash:'5 6',description:'策展式教學比較，不聲稱影響或傳承'}};
export function edgeCurve(edge){const a=mapPoint(edge.from),b=mapPoint(edge.to),dx=b.x-a.x,dz=b.z-a.z,l=Math.hypot(dx,dz)||1;const bend=edge.bend??Math.min(20,l*.2);return {a,b,c:{x:(a.x+b.x)/2-dz/l*bend,z:(a.z+b.z)/2+dx/l*bend}};}
export function edgePoint(edge,t){const {a,b,c}=edgeCurve(edge),u=1-t;return {x:u*u*a.x+2*u*t*c.x+t*t*b.x,z:u*u*a.z+2*u*t*c.z+t*t*b.z};}
