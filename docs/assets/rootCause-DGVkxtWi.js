const i=[{key:"proximate",label:"Trigger"},{key:"medium_term",label:"Enabling condition"},{key:"deeper_structural",label:"Structural factor",alias:"structural"}];function l(e){if(typeof e=="string"){const t=e.trim();return t?[{key:"text",label:null,text:t}]:[]}return!e||typeof e!="object"?[]:i.map(({key:t,label:o,alias:n})=>{const r=e[t]??(n?e[n]:void 0);return typeof r=="string"&&r.trim()?{key:t,label:o,text:r.trim()}:null}).filter(Boolean)}function a(e){return l(e).map(t=>t.label?`${t.label}: ${t.text}`:t.text).join(`

`)}export{a,l as r};
