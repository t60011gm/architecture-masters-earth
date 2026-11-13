import {createMiniatureA,MINIATURE_INFO_A} from './miniatures-a.js';
import {createMiniatureB,MINIATURE_INFO_B} from './miniatures-b.js';
export const MINIATURE_INFO={...MINIATURE_INFO_A,...MINIATURE_INFO_B};
export function createMiniature(item){const model=item.id<=13?createMiniatureA(item):createMiniatureB(item);if(!model)throw Error(`Missing miniature ${item.id}`);model.name=`chibi-${item.slug}`;model.userData={...model.userData,islandId:item.id,schematic:true};return model;}
