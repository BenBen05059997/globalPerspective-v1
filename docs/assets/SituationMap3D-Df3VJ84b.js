const __vite__mapDeps=(i,m=__vite__mapDeps,d=(m.f||(m.f=["assets/index-BypCt1wZ.js","assets/expression-Bl_GL2tO.js","assets/index-BGSN7GAp.js","assets/index-mMJtBawD.css","assets/landGeometry-CnC2mppU.js","assets/RadarMap-BvQEE5uS.js","assets/SituationMap-CxNN0RBH.js","assets/situationLabels-C5eJ6Olk.js","assets/equalEarth-BU7OrtWy.js","assets/storyLinkArcs-DZaRVGuV.js","assets/storyMode-BM8Ka3nr.js","assets/questionStates-CyE5tYXP.js","assets/storyMode-CyPgSsiU.css","assets/globeSpin-BncN9_zE.js","assets/crisisHue-DEaGCysw.js","assets/index-CPdkqp3I.js"])))=>i.map(i=>d[i]);
import{_ as ir,r as N,ao as Cy,j as de}from"./index-BGSN7GAp.js";import{f as Ly,t as hu}from"./landGeometry-CnC2mppU.js";import{s as gu,d as Ty,a as pu,t as un,m as Ay,f as My,I as nr,h as wo,p as Iy,g as Po,c as Ry}from"./RadarMap-BvQEE5uS.js";import{e as Oy,D as mu}from"./storyLinkArcs-DZaRVGuV.js";import{g as Qh,t as ky,s as By,a as Jh,b as Dy}from"./globeSpin-BncN9_zE.js";import{C as yu}from"./crisisHue-DEaGCysw.js";import{b as Fy,n as zy,e as _u,h as Da,c as eg,d as bu,f as tg,i as Ny,s as ht,j as gt,k as Uy,r as pt,A as So}from"./equalEarth-BU7OrtWy.js";var Pn,sr,rr,or,ar,cr,lr,ur,Fa,za,Na,ig,ng,Le,Te,Ae,qe={sphere:zy,point:Vc,lineStart:vu,lineEnd:xu,polygonStart:function(){qe.lineStart=Vy,qe.lineEnd=jy},polygonEnd:function(){qe.lineStart=vu,qe.lineEnd=xu}};function Vc(i,e){i*=pt,e*=pt;var t=gt(e);Kn(t*gt(i),t*ht(i),ht(e))}function Kn(i,e,t){++Pn,rr+=(i-rr)/Pn,or+=(e-or)/Pn,ar+=(t-ar)/Pn}function vu(){qe.point=$y}function $y(i,e){i*=pt,e*=pt;var t=gt(e);Le=t*gt(i),Te=t*ht(i),Ae=ht(e),qe.point=Gy,Kn(Le,Te,Ae)}function Gy(i,e){i*=pt,e*=pt;var t=gt(e),n=t*gt(i),s=t*ht(i),r=ht(e),o=eg(Uy((o=Te*r-Ae*s)*o+(o=Ae*n-Le*r)*o+(o=Le*s-Te*n)*o),Le*n+Te*s+Ae*r);sr+=o,cr+=o*(Le+(Le=n)),lr+=o*(Te+(Te=s)),ur+=o*(Ae+(Ae=r)),Kn(Le,Te,Ae)}function xu(){qe.point=Vc}function Vy(){qe.point=Wy}function jy(){sg(ig,ng),qe.point=Vc}function Wy(i,e){ig=i,ng=e,i*=pt,e*=pt,qe.point=sg;var t=gt(e);Le=t*gt(i),Te=t*ht(i),Ae=ht(e),Kn(Le,Te,Ae)}function sg(i,e){i*=pt,e*=pt;var t=gt(e),n=t*gt(i),s=t*ht(i),r=ht(e),o=Te*r-Ae*s,a=Ae*n-Le*r,c=Le*s-Te*n,l=Da(o,a,c),u=tg(l),f=l&&-u/l;Fa.add(f*o),za.add(f*a),Na.add(f*c),sr+=u,cr+=u*(Le+(Le=n)),lr+=u*(Te+(Te=s)),ur+=u*(Ae+(Ae=r)),Kn(Le,Te,Ae)}function Hy(i){Pn=sr=rr=or=ar=cr=lr=ur=0,Fa=new So,za=new So,Na=new So,Fy(i,qe);var e=+Fa,t=+za,n=+Na,s=Da(e,t,n);return s<_u&&(e=cr,t=lr,n=ur,sr<Ny&&(e=rr,t=or,n=ar),s=Da(e,t,n),s<_u)?[NaN,NaN]:[eg(t,e)*bu,tg(n/s)*bu]}function fr(i,e){if(!i)throw new Error(e||"loader assertion failed.")}const jc=!!(typeof process!="object"||String(process)!=="[object process]"||process.browser),wu=typeof process<"u"&&process.version&&/v([0-9]*)/.exec(process.version);wu&&parseFloat(wu[1]);const Eo=globalThis,Pu=globalThis.process||{},Yy=globalThis.navigator||{};function rg(i){if(typeof window<"u"&&window.process?.type==="renderer"||typeof process<"u"&&process.versions?.electron)return!0;const t=typeof navigator<"u"&&navigator.userAgent;return!!(t&&t.indexOf("Electron")>=0)}function Ji(){return!(typeof process=="object"&&String(process)==="[object process]"&&!process?.browser)||rg()}function qy(i){return Ji()?rg()?"Electron":(Yy.userAgent||"").indexOf("Edge")>-1?"Edge":globalThis.chrome?"Chrome":globalThis.safari?"Safari":globalThis.mozInnerScreenX?"Firefox":"Unknown":"Node"}const og="4.1.2";function Wc(i,e){if(!i)throw new Error("Assertion failed")}function ag(i){if(!i)return 0;let e;switch(typeof i){case"number":e=i;break;case"object":e=i.logLevel||i.priority||0;break;default:return 0}return Wc(Number.isFinite(e)&&e>=0),e}function Zy(i){const{logLevel:e,message:t}=i;i.logLevel=ag(e);const n=i.args?Array.from(i.args):[];for(;n.length&&n.shift()!==t;);switch(typeof e){case"string":case"function":t!==void 0&&n.unshift(t),i.message=e;break;case"object":Object.assign(i,e);break}typeof i.message=="function"&&(i.message=i.message());const s=typeof i.message;return Wc(s==="string"||s==="object"),Object.assign(i,{args:n},i.opts)}const Oi=()=>{};class Xy{constructor({level:e=0}={}){this.userData={},this._onceCache=new Set,this._level=e}set level(e){this.setLevel(e)}get level(){return this.getLevel()}setLevel(e){return this._level=e,this}getLevel(){return this._level}warn(e,...t){return this._log("warn",0,e,t,{once:!0})}error(e,...t){return this._log("error",0,e,t)}log(e,t,...n){return this._log("log",e,t,n)}info(e,t,...n){return this._log("info",e,t,n)}once(e,t,...n){return this._log("once",e,t,n,{once:!0})}_log(e,t,n,s,r={}){const o=Zy({logLevel:t,message:n,args:this._buildArgs(t,n,s),opts:r});return this._createLogFunction(e,o,r)}_buildArgs(e,t,n){return[e,t,...n]}_createLogFunction(e,t,n){if(!this._shouldLog(t.logLevel))return Oi;const s=this._getOnceTag(n.tag??t.tag??t.message);if((n.once||t.once)&&s!==void 0){if(this._onceCache.has(s))return Oi;this._onceCache.add(s)}return this._emit(e,t)}_shouldLog(e){return this.getLevel()>=ag(e)}_getOnceTag(e){if(e!==void 0)try{return typeof e=="string"?e:String(e)}catch{return}}}function Ky(i){try{const e=window[i],t="__storage_test__";return e.setItem(t,t),e.removeItem(t),e}catch{return null}}class Qy{constructor(e,t,n="sessionStorage"){this.storage=Ky(n),this.id=e,this.config=t,this._loadConfiguration()}getConfiguration(){return this.config}setConfiguration(e){if(Object.assign(this.config,e),this.storage){const t=JSON.stringify(this.config);this.storage.setItem(this.id,t)}}_loadConfiguration(){let e={};if(this.storage){const t=this.storage.getItem(this.id);e=t?JSON.parse(t):{}}return Object.assign(this.config,e),this}}function Jy(i){let e;return i<10?e=`${i.toFixed(2)}ms`:i<100?e=`${i.toFixed(1)}ms`:i<1e3?e=`${i.toFixed(0)}ms`:e=`${(i/1e3).toFixed(2)}s`,e}function e_(i,e=8){const t=Math.max(e-i.length,0);return`${" ".repeat(t)}${i}`}var dr;(function(i){i[i.BLACK=30]="BLACK",i[i.RED=31]="RED",i[i.GREEN=32]="GREEN",i[i.YELLOW=33]="YELLOW",i[i.BLUE=34]="BLUE",i[i.MAGENTA=35]="MAGENTA",i[i.CYAN=36]="CYAN",i[i.WHITE=37]="WHITE",i[i.BRIGHT_BLACK=90]="BRIGHT_BLACK",i[i.BRIGHT_RED=91]="BRIGHT_RED",i[i.BRIGHT_GREEN=92]="BRIGHT_GREEN",i[i.BRIGHT_YELLOW=93]="BRIGHT_YELLOW",i[i.BRIGHT_BLUE=94]="BRIGHT_BLUE",i[i.BRIGHT_MAGENTA=95]="BRIGHT_MAGENTA",i[i.BRIGHT_CYAN=96]="BRIGHT_CYAN",i[i.BRIGHT_WHITE=97]="BRIGHT_WHITE"})(dr||(dr={}));const t_=10;function Su(i){return typeof i!="string"?i:(i=i.toUpperCase(),dr[i]||dr.WHITE)}function i_(i,e,t){return!Ji&&typeof i=="string"&&(e&&(i=`\x1B[${Su(e)}m${i}\x1B[39m`),t&&(i=`\x1B[${Su(t)+t_}m${i}\x1B[49m`)),i}function n_(i,e=["constructor"]){const t=Object.getPrototypeOf(i),n=Object.getOwnPropertyNames(t),s=i;for(const r of n){const o=s[r];typeof o=="function"&&(e.find(a=>r===a)||(s[r]=o.bind(i)))}}class cg{getHighResolutionTimer(){let e;if(Ji()&&Eo.performance)e=Eo?.performance?.now?.();else if("hrtime"in Pu){const t=Pu?.hrtime?.();e=t[0]*1e3+t[1]/1e6}else e=Date.now();return e}getMemoryUsageMB(){const t=Eo?.performance?.memory?.usedJSHeapSize;return t==null?null:Math.trunc(t/1024/1024)}}const Xt=new cg;globalThis.Probe=cg;globalThis.probe=Xt;const wi={debug:Ji()&&console.debug||console.log,log:console.log,info:console.info,warn:console.warn,error:console.error},Co={enabled:!0,level:0};class Qn extends Xy{constructor({id:e}={id:""}){super({level:0}),this.VERSION=og,this._startTs=Xt.getHighResolutionTimer(),this._deltaTs=Xt.getHighResolutionTimer(),this.userData={},this.LOG_THROTTLE_TIMEOUT=0,this.id=e,this.userData={},this._storage=new Qy(`__probe-${this.id}__`,{[this.id]:Co}),this.timeStamp(`${this.id} started`),n_(this),Object.seal(this)}isEnabled(){return this._getConfiguration().enabled}getLevel(){return this._getConfiguration().level}getTotal(){return Number((Xt.getHighResolutionTimer()-this._startTs).toPrecision(10))}getDelta(){return Number((Xt.getHighResolutionTimer()-this._deltaTs).toPrecision(10))}set priority(e){this.level=e}get priority(){return this.level}getPriority(){return this.level}enable(e=!0){return this._updateConfiguration({enabled:e}),this}setLevel(e){return this._updateConfiguration({level:e}),this}get(e){return this._getConfiguration()[e]}set(e,t){this._updateConfiguration({[e]:t})}settings(){console.table?console.table(this._storage.config):console.log(this._storage.config)}assert(e,t){if(!e)throw new Error(t||"Assertion failed")}warn(e,...t){return this._log("warn",0,e,t,{method:wi.warn,once:!0})}error(e,...t){return this._log("error",0,e,t,{method:wi.error})}deprecated(e,t){return this.warn(`\`${e}\` is deprecated and will be removed in a later version. Use \`${t}\` instead`)}removed(e,t){return this.error(`\`${e}\` has been removed. Use \`${t}\` instead`)}probe(e,t,...n){const s=Xt.getMemoryUsageMB();if(s!==null){const r=`${s}MB `;typeof t=="function"?t=()=>`${r}${t()}`:typeof t=="string"&&(t=`${r}${t}`)}return this._log("log",e,t,n,{method:wi.log,time:!0,once:!0})}log(e,t,...n){return this._log("log",e,t,n,{method:wi.debug})}info(e,t,...n){return this._log("info",e,t,n,{method:console.info})}once(e,t,...n){return this._log("once",e,t,n,{method:wi.debug||wi.info,once:!0})}table(e,t,n){return t?this._log("table",e,t,n&&[n]||[],{method:console.table||Oi,tag:r_(t)}):Oi}time(e,t){return this._log("time",e,t,[],{method:console.time?console.time:console.info})}timeEnd(e,t){return this._log("time",e,t,[],{method:console.timeEnd?console.timeEnd:console.info})}timeStamp(e,t){return this._log("time",e,t,[],{method:console.timeStamp||Oi})}group(e,t,n={collapsed:!1}){const s=(n.collapsed?console.groupCollapsed:console.group)||console.info;return this._log("group",e,t,[],{method:s})}groupCollapsed(e,t,n={}){return this.group(e,t,Object.assign({},n,{collapsed:!0}))}groupEnd(e){return this._log("groupEnd",e,"",[],{method:console.groupEnd||Oi})}withGroup(e,t,n){this.group(e,t)();try{n()}finally{this.groupEnd(e)()}}trace(){console.trace&&console.trace()}_shouldLog(e){return this.isEnabled()&&super._shouldLog(e)}_emit(e,t){const n=t.method;Wc(n),t.total=this.getTotal(),t.delta=this.getDelta(),this._deltaTs=Xt.getHighResolutionTimer();const s=s_(this.id,t.message,t);return n.bind(console,s,...t.args)}_getConfiguration(){return this._storage.config[this.id]||this._updateConfiguration(Co),this._storage.config[this.id]}_updateConfiguration(e){const t=this._storage.config[this.id]||{...Co};this._storage.setConfiguration({[this.id]:{...t,...e}})}}Qn.VERSION=og;function s_(i,e,t){if(typeof e=="string"){const n=t.time?e_(Jy(t.total)):"";e=t.time?`${i}: ${n}  ${e}`:`${i}: ${e}`,e=i_(e,t.color,t.background)}return e}function r_(i){for(const e in i)for(const t in i[e])return t||"untitled";return"empty"}const Lo="4.4.5",o_=Lo[0]>="0"&&Lo[0]<="9"?`v${Lo}`:"";function a_(){const i=new Qn({id:"loaders.gl"});return globalThis.loaders||={},globalThis.loaders.log=i,globalThis.loaders.version=o_,globalThis.probe||={},globalThis.probe.loaders=i,i}const c_=a_(),l_=i=>typeof i=="boolean",dt=i=>typeof i=="function",gi=i=>i!==null&&typeof i=="object",Eu=i=>gi(i)&&i.constructor==={}.constructor,lg=i=>typeof SharedArrayBuffer<"u"&&i instanceof SharedArrayBuffer,Hc=i=>gi(i)&&typeof i.byteLength=="number"&&typeof i.slice=="function",u_=i=>!!i&&dt(i[Symbol.iterator]),f_=i=>!!i&&dt(i[Symbol.asyncIterator]),pi=i=>typeof Response<"u"&&i instanceof Response||gi(i)&&dt(i.arrayBuffer)&&dt(i.text)&&dt(i.json),mi=i=>typeof Blob<"u"&&i instanceof Blob,d_=i=>typeof ReadableStream<"u"&&i instanceof ReadableStream||gi(i)&&dt(i.tee)&&dt(i.cancel)&&dt(i.getReader),h_=i=>gi(i)&&dt(i.read)&&dt(i.pipe)&&l_(i.readable),ug=i=>d_(i)||h_(i);function g_(i,e){return fg(i||{},e)}function fg(i,e,t=0){if(t>3)return e;const n={...i};for(const[s,r]of Object.entries(e))r&&typeof r=="object"&&!Array.isArray(r)?n[s]=fg(n[s]||{},e[s],t+1):n[s]=e[s];return n}const p_="latest";function m_(){return globalThis._loadersgl_?.version||(globalThis._loadersgl_=globalThis._loadersgl_||{},globalThis._loadersgl_.version="4.4.5"),globalThis._loadersgl_.version}const y_=m_();function Gt(i,e){if(!i)throw new Error(e||"loaders.gl assertion failed.")}const ni=typeof process!="object"||String(process)!=="[object process]"||process.browser,__=typeof window<"u"&&typeof window.orientation<"u",Cu=typeof process<"u"&&process.version&&/v([0-9]*)/.exec(process.version);Cu&&parseFloat(Cu[1]);class b_{name;workerThread;isRunning=!0;result;_resolve=()=>{};_reject=()=>{};constructor(e,t){this.name=e,this.workerThread=t,this.result=new Promise((n,s)=>{this._resolve=n,this._reject=s})}postMessage(e,t){this.workerThread.postMessage({source:"loaders.gl",type:e,payload:t})}done(e){Gt(this.isRunning),this.isRunning=!1,this._resolve(e)}error(e){Gt(this.isRunning),this.isRunning=!1,this._reject(e)}}class To{terminate(){}}const Ao=new Map;function v_(i){Gt(i.source&&!i.url||!i.source&&i.url);let e=Ao.get(i.source||i.url);return e||(i.url&&(e=x_(i.url),Ao.set(i.url,e)),i.source&&(e=dg(i.source),Ao.set(i.source,e))),Gt(e),e}function x_(i){if(!i.startsWith("http"))return i;const e=w_(i);return dg(e)}function dg(i){const e=new Blob([i],{type:"application/javascript"});return URL.createObjectURL(e)}function w_(i){return`try {
  importScripts('${i}');
} catch (error) {
  console.error(error);
  throw error;
}`}function hg(i,e=!0,t){const n=t||new Set;if(i){if(Lu(i))n.add(i);else if(Lu(i.buffer))n.add(i.buffer);else if(!ArrayBuffer.isView(i)){if(e&&typeof i=="object")for(const s in i)hg(i[s],e,n)}}return t===void 0?Array.from(n):[]}function Lu(i){return i?i instanceof ArrayBuffer||typeof MessagePort<"u"&&i instanceof MessagePort||typeof ImageBitmap<"u"&&i instanceof ImageBitmap||typeof OffscreenCanvas<"u"&&i instanceof OffscreenCanvas:!1}const Mo=()=>{};class Ua{name;source;url;terminated=!1;worker;onMessage;onError;_loadableURL="";static isSupported(){return typeof Worker<"u"&&ni||typeof To<"u"&&!ni}constructor(e){const{name:t,source:n,url:s}=e;Gt(n||s),this.name=t,this.source=n,this.url=s,this.onMessage=Mo,this.onError=r=>console.log(r),this.worker=ni?this._createBrowserWorker():this._createNodeWorker()}destroy(){this.onMessage=Mo,this.onError=Mo,this.worker.terminate(),this.terminated=!0}get isRunning(){return!!this.onMessage}postMessage(e,t){t=t||hg(e),this.worker.postMessage(e,t)}_getErrorFromErrorEvent(e){let t="Failed to load ";return t+=`worker ${this.name} from ${this.url}. `,e.message&&(t+=`${e.message} in `),e.lineno&&(t+=`:${e.lineno}:${e.colno}`),new Error(t)}_createBrowserWorker(){this._loadableURL=v_({source:this.source,url:this.url});const e=new Worker(this._loadableURL,{name:this.name});return e.onmessage=t=>{t.data?this.onMessage(t.data):this.onError(new Error("No data received"))},e.onerror=t=>{this.onError(this._getErrorFromErrorEvent(t)),this.terminated=!0},e.onmessageerror=t=>console.error(t),e}_createNodeWorker(){let e;if(this.url){const n=this.url.includes(":/")||this.url.startsWith("/")?this.url:`./${this.url}`,s=this.url.endsWith(".ts")||this.url.endsWith(".mjs")?"module":"commonjs";e=new To(n,{eval:!1,type:s})}else if(this.source)e=new To(this.source,{eval:!0});else throw new Error("no worker");return e.on("message",t=>{this.onMessage(t)}),e.on("error",t=>{this.onError(t)}),e.on("exit",t=>{}),e}}class P_{name="unnamed";source;url;maxConcurrency=1;maxMobileConcurrency=1;onDebug=()=>{};reuseWorkers=!0;props={};jobQueue=[];idleQueue=[];count=0;isDestroyed=!1;static isSupported(){return Ua.isSupported()}constructor(e){this.source=e.source,this.url=e.url,this.setProps(e)}destroy(){this.idleQueue.forEach(e=>e.destroy()),this.isDestroyed=!0}setProps(e){this.props={...this.props,...e},e.name!==void 0&&(this.name=e.name),e.maxConcurrency!==void 0&&(this.maxConcurrency=e.maxConcurrency),e.maxMobileConcurrency!==void 0&&(this.maxMobileConcurrency=e.maxMobileConcurrency),e.reuseWorkers!==void 0&&(this.reuseWorkers=e.reuseWorkers),e.onDebug!==void 0&&(this.onDebug=e.onDebug)}async startJob(e,t=(s,r,o)=>s.done(o),n=(s,r)=>s.error(r)){const s=new Promise(r=>(this.jobQueue.push({name:e,onMessage:t,onError:n,onStart:r}),this));return this._startQueuedJob(),await s}async _startQueuedJob(){if(!this.jobQueue.length)return;const e=this._getAvailableWorker();if(!e)return;const t=this.jobQueue.shift();if(t){this.onDebug({message:"Starting job",name:t.name,workerThread:e,backlog:this.jobQueue.length});const n=new b_(t.name,e);e.onMessage=s=>t.onMessage(n,s.type,s.payload),e.onError=s=>t.onError(n,s),t.onStart(n);try{await n.result}catch(s){console.error(`Worker exception: ${s}`)}finally{this.returnWorkerToQueue(e)}}}returnWorkerToQueue(e){!ni||this.isDestroyed||!this.reuseWorkers||this.count>this._getMaxConcurrency()?(e.destroy(),this.count--):this.idleQueue.push(e),this.isDestroyed||this._startQueuedJob()}_getAvailableWorker(){if(this.idleQueue.length>0)return this.idleQueue.shift()||null;if(this.count<this._getMaxConcurrency()){this.count++;const e=`${this.name.toLowerCase()} (#${this.count} of ${this.maxConcurrency})`;return new Ua({name:e,source:this.source,url:this.url})}return null}_getMaxConcurrency(){return __?this.maxMobileConcurrency:this.maxConcurrency}}const S_={maxConcurrency:3,maxMobileConcurrency:1,reuseWorkers:!0,onDebug:()=>{}};class Ot{props;workerPools=new Map;static _workerFarm;static isSupported(){return Ua.isSupported()}static getWorkerFarm(e={}){return Ot._workerFarm=Ot._workerFarm||new Ot({}),Ot._workerFarm.setProps(e),Ot._workerFarm}constructor(e){this.props={...S_},this.setProps(e),this.workerPools=new Map}destroy(){for(const e of this.workerPools.values())e.destroy();this.workerPools=new Map}setProps(e){this.props={...this.props,...e};for(const t of this.workerPools.values())t.setProps(this._getWorkerPoolProps())}getWorkerPool(e){const{name:t,source:n,url:s}=e;let r=this.workerPools.get(t);return r||(r=new P_({name:t,source:n,url:s}),r.setProps(this._getWorkerPoolProps()),this.workerPools.set(t,r)),r}_getWorkerPoolProps(){return{maxConcurrency:this.props.maxConcurrency,maxMobileConcurrency:this.props.maxMobileConcurrency,reuseWorkers:this.props.reuseWorkers,onDebug:this.props.onDebug}}}function E_(i,e={}){const t=e[i.id]||{},n=ni?`${i.id}-worker.js`:`${i.id}-worker-node.js`;let s=t.workerUrl;if(!s&&i.id==="compression"&&(s=e.workerUrl),(e._workerType||e?.core?._workerType)==="test"&&(ni?s=`modules/${i.module}/dist/${n}`:s=`modules/${i.module}/src/workers/${i.id}-worker-node.ts`),!s){let o=i.version;o==="latest"&&(o=p_);const a=o?`@${o}`:"";s=`https://unpkg.com/@loaders.gl/${i.module}${a}/dist/${n}`}return Gt(s),s}function C_(i,e=y_){Gt(i,"no worker provided");const t=i.version;return!(!e||!t)}function L_(i,e){if(!Ot.isSupported())return!1;const t=e?._nodeWorkers??e?.core?._nodeWorkers;if(!ni&&!t)return!1;const n=e?.worker??e?.core?.worker;return!!(i.worker&&n)}async function T_(i,e,t,n,s){const r=i.id,o=E_(i,t),c=Ot.getWorkerFarm(t?.core).getWorkerPool({name:r,url:o});t=JSON.parse(JSON.stringify(t)),n=JSON.parse(JSON.stringify(n||{}));const l=await c.startJob("process-on-worker",A_.bind(null,s));return l.postMessage("process",{input:e,options:t,context:n}),await(await l.result).result}async function A_(i,e,t,n){switch(t){case"done":e.done(n);break;case"error":e.error(new Error(n.error));break;case"process":const{id:s,input:r,options:o}=n;try{const a=await i(r,o);e.postMessage("done",{id:s,result:a})}catch(a){const c=a instanceof Error?a.message:"unknown error";e.postMessage("error",{id:s,error:c})}break;default:console.warn(`parse-with-worker unknown message ${t}`)}}function M_(i,e,t){if(t=t||i.byteLength,i.byteLength<t||e.byteLength<t)return!1;const n=new Uint8Array(i),s=new Uint8Array(e);for(let r=0;r<n.length;++r)if(n[r]!==s[r])return!1;return!0}function I_(...i){return R_(i)}function R_(i){const e=i.map(r=>r instanceof ArrayBuffer?new Uint8Array(r):r),t=e.reduce((r,o)=>r+o.byteLength,0),n=new Uint8Array(t);let s=0;for(const r of e)n.set(r,s),s+=r.byteLength;return n.buffer}async function O_(i){const e=[];for await(const t of i)e.push(k_(t));return I_(...e)}function k_(i){if(i instanceof ArrayBuffer)return i;if(ArrayBuffer.isView(i)){const{buffer:e,byteOffset:t,byteLength:n}=i;return Tu(e,t,n)}return Tu(i)}function Tu(i,e=0,t=i.byteLength-e){const n=new Uint8Array(i,e,t),s=new Uint8Array(n.length);return s.set(n),s.buffer}function Au(){let i;if(typeof window<"u"&&window.performance)i=window.performance.now();else if(typeof process<"u"&&process.hrtime){const e=process.hrtime();i=e[0]*1e3+e[1]/1e6}else i=Date.now();return i}class Mu{constructor(e,t){this.sampleSize=1,this.time=0,this.count=0,this.samples=0,this.lastTiming=0,this.lastSampleTime=0,this.lastSampleCount=0,this._count=0,this._time=0,this._samples=0,this._startTime=0,this._timerPending=!1,this.name=e,this.type=t,this.reset()}reset(){return this.time=0,this.count=0,this.samples=0,this.lastTiming=0,this.lastSampleTime=0,this.lastSampleCount=0,this._count=0,this._time=0,this._samples=0,this._startTime=0,this._timerPending=!1,this}setSampleSize(e){return this.sampleSize=e,this}incrementCount(){return this.addCount(1),this}decrementCount(){return this.subtractCount(1),this}addCount(e){return this._count+=e,this._samples++,this._checkSampling(),this}subtractCount(e){return this._count-=e,this._samples++,this._checkSampling(),this}addTime(e){return this._time+=e,this.lastTiming=e,this._samples++,this._checkSampling(),this}timeStart(){return this._startTime=Au(),this._timerPending=!0,this}timeEnd(){return this._timerPending?(this.addTime(Au()-this._startTime),this._timerPending=!1,this._checkSampling(),this):this}getSampleAverageCount(){return this.sampleSize>0?this.lastSampleCount/this.sampleSize:0}getSampleAverageTime(){return this.sampleSize>0?this.lastSampleTime/this.sampleSize:0}getSampleHz(){return this.lastSampleTime>0?this.sampleSize/(this.lastSampleTime/1e3):0}getAverageCount(){return this.samples>0?this.count/this.samples:0}getAverageTime(){return this.samples>0?this.time/this.samples:0}getHz(){return this.time>0?this.samples/(this.time/1e3):0}_checkSampling(){this._samples===this.sampleSize&&(this.lastSampleTime=this._time,this.lastSampleCount=this._count,this.count+=this._count,this.time+=this._time,this.samples+=this._samples,this._time=0,this._count=0,this._samples=0)}}class Ur{constructor(e){this.stats={},this.id=e.id,this.stats={},this._initializeStats(e.stats),Object.seal(this)}get(e,t="count"){return this._getOrCreate({name:e,type:t})}get size(){return Object.keys(this.stats).length}reset(){for(const e of Object.values(this.stats))e.reset();return this}forEach(e){for(const t of Object.values(this.stats))e(t)}getTable(){const e={};return this.forEach(t=>{e[t.name]={time:t.time||0,count:t.count||0,average:t.getAverageTime()||0,hz:t.getHz()||0}}),e}_initializeStats(e=[]){e.forEach(t=>this._getOrCreate(t))}_getOrCreate(e){const{name:t,type:n}=e;let s=this.stats[t];return s||(e instanceof Mu?s=e:s=new Mu(t,n),this.stats[t]=s),s}}let B_="";const Iu={};function D_(i){for(const e in Iu)if(i.startsWith(e)){const t=Iu[e];i=i.replace(e,t)}return!i.startsWith("http://")&&!i.startsWith("https://")&&(i=`${B_}${i}`),i}function gg(i){return i&&typeof i=="object"&&i.isBuffer}function Yc(i){if(gg(i))return i;if(i instanceof ArrayBuffer)return i;if(lg(i))return $a(i);if(ArrayBuffer.isView(i)){const e=i.buffer;return i.byteOffset===0&&i.byteLength===i.buffer.byteLength?e:e.slice(i.byteOffset,i.byteOffset+i.byteLength)}if(typeof i=="string"){const e=i;return new TextEncoder().encode(e).buffer}if(i&&typeof i=="object"&&i._toArrayBuffer)return i._toArrayBuffer();throw new Error("toArrayBuffer")}function pg(i){if(i instanceof ArrayBuffer)return i;if(lg(i))return $a(i);const{buffer:e,byteOffset:t,byteLength:n}=i;return e instanceof ArrayBuffer&&t===0&&n===e.byteLength?e:$a(e,t,n)}function $a(i,e=0,t=i.byteLength-e){const n=new Uint8Array(i,e,t),s=new Uint8Array(n.length);return s.set(n),s.buffer}function F_(i){return ArrayBuffer.isView(i)?i:new Uint8Array(i)}function mg(i){const e=i?i.lastIndexOf("/"):-1;return e>=0?i.substr(e+1):i}function yg(i){const e=i?i.lastIndexOf("/"):-1;return e>=0?i.substr(0,e):""}class z_ extends Error{constructor(e,t){super(e),this.reason=t.reason,this.url=t.url,this.response=t.response}reason;url;response}const N_=/^data:([-\w.]+\/[-\w.+]+)(;|,)/,U_=/^([-\w.]+\/[-\w.+]+)/;function Ru(i,e){return i.toLowerCase()===e.toLowerCase()}function $_(i){const e=U_.exec(i);return e?e[1]:i}function Ou(i){const e=N_.exec(i);return e?e[1]:""}const _g=/\?.*/;function G_(i){const e=i.match(_g);return e&&e[0]}function $r(i){return i.replace(_g,"")}function V_(i){if(i.length<50)return i;const e=i.slice(i.length-15);return`${i.substr(0,32)}...${e}`}function Gr(i){return pi(i)?i.url:mi(i)?("name"in i?i.name:"")||"":typeof i=="string"?i:""}function Vr(i){if(pi(i)){const e=i.headers.get("content-type")||"",t=$r(i.url);return $_(e)||Ou(t)}return mi(i)?i.type||"":typeof i=="string"?Ou(i):""}function j_(i){return pi(i)?i.headers["content-length"]||-1:mi(i)?i.size:typeof i=="string"?i.length:i instanceof ArrayBuffer||ArrayBuffer.isView(i)?i.byteLength:-1}async function bg(i){if(pi(i))return i;const e={},t=j_(i);t>=0&&(e["content-length"]=String(t));const n=Gr(i),s=Vr(i);s&&(e["content-type"]=s);const r=await Y_(i);r&&(e["x-first-bytes"]=r),typeof i=="string"&&(i=new TextEncoder().encode(i));const o=new Response(i,{headers:e});return Object.defineProperty(o,"url",{value:n}),o}async function W_(i){if(!i.ok)throw await H_(i)}async function H_(i){const e=V_(i.url);let t=`Failed to fetch resource (${i.status}) ${i.statusText}: ${e}`;t=t.length>100?`${t.slice(0,100)}...`:t;const n={reason:i.statusText,url:i.url,response:i};try{const s=i.headers.get("Content-Type");n.reason=!i.bodyUsed&&s?.includes("application/json")?await i.json():await i.text()}catch{}return new z_(t,n)}async function Y_(i){if(typeof i=="string")return`data:,${i.slice(0,5)}`;if(i instanceof Blob){const t=i.slice(0,5);return await new Promise(n=>{const s=new FileReader;s.onload=r=>n(r?.target?.result),s.readAsDataURL(t)})}if(i instanceof ArrayBuffer){const t=i.slice(0,5);return`data:base64,${q_(t)}`}return null}function q_(i){let e="";const t=new Uint8Array(i);for(let n=0;n<t.byteLength;n++)e+=String.fromCharCode(t[n]);return btoa(e)}function Z_(i){return!X_(i)&&!K_(i)}function X_(i){return i.startsWith("http:")||i.startsWith("https:")}function K_(i){return i.startsWith("data:")}async function ku(i,e){if(typeof i=="string"){const t=D_(i);return Z_(t)&&globalThis.loaders?.fetchNode?globalThis.loaders?.fetchNode(t,e):await fetch(t,e)}return await bg(i)}const fs=new Qn({id:"loaders.gl"});class Q_{log(){return()=>{}}info(){return()=>{}}warn(){return()=>{}}error(){return()=>{}}}class J_{console;constructor(){this.console=console}log(...e){return this.console.log.bind(this.console,...e)}info(...e){return this.console.info.bind(this.console,...e)}warn(...e){return this.console.warn.bind(this.console,...e)}error(...e){return this.console.error.bind(this.console,...e)}}const Ga={core:{baseUrl:void 0,fetch:null,mimeType:void 0,fallbackMimeType:void 0,ignoreRegisteredLoaders:void 0,nothrow:!1,log:new J_,useLocalLibraries:!1,CDN:"https://unpkg.com/@loaders.gl",worker:!0,maxConcurrency:3,maxMobileConcurrency:1,reuseWorkers:jc,_nodeWorkers:!1,_workerType:"",limit:0,_limitMB:0,batchSize:"auto",batchDebounceMs:0,metadata:!1,transforms:[]}},eb={baseUri:"core.baseUrl",fetch:"core.fetch",mimeType:"core.mimeType",fallbackMimeType:"core.fallbackMimeType",ignoreRegisteredLoaders:"core.ignoreRegisteredLoaders",nothrow:"core.nothrow",log:"core.log",useLocalLibraries:"core.useLocalLibraries",CDN:"core.CDN",worker:"core.worker",maxConcurrency:"core.maxConcurrency",maxMobileConcurrency:"core.maxMobileConcurrency",reuseWorkers:"core.reuseWorkers",_nodeWorkers:"core.nodeWorkers",_workerType:"core._workerType",_worker:"core._workerType",limit:"core.limit",_limitMB:"core._limitMB",batchSize:"core.batchSize",batchDebounceMs:"core.batchDebounceMs",metadata:"core.metadata",transforms:"core.transforms",throws:"nothrow",dataType:"(no longer used)",uri:"core.baseUrl",method:"core.fetch.method",headers:"core.fetch.headers",body:"core.fetch.body",mode:"core.fetch.mode",credentials:"core.fetch.credentials",cache:"core.fetch.cache",redirect:"core.fetch.redirect",referrer:"core.fetch.referrer",referrerPolicy:"core.fetch.referrerPolicy",integrity:"core.fetch.integrity",keepalive:"core.fetch.keepalive",signal:"core.fetch.signal"},qc=["baseUrl","fetch","mimeType","fallbackMimeType","ignoreRegisteredLoaders","nothrow","log","useLocalLibraries","CDN","worker","maxConcurrency","maxMobileConcurrency","reuseWorkers","_nodeWorkers","_workerType","limit","_limitMB","batchSize","batchDebounceMs","metadata","transforms"];function vg(){globalThis.loaders=globalThis.loaders||{};const{loaders:i}=globalThis;return i._state||(i._state={}),i._state}function xg(){const i=vg();return i.globalOptions=i.globalOptions||{...Ga,core:{...Ga.core}},ci(i.globalOptions)}function tb(i,e,t,n){return t=t||[],t=Array.isArray(t)?t:[t],ib(i,t),ci(sb(e,i,n))}function ci(i){const e=ob(i);wg(e);for(const t of qc)e.core&&e.core[t]!==void 0&&delete e[t];return e.core&&e.core._workerType!==void 0&&delete e._worker,e}function ib(i,e){Bu(i,null,Ga,eb,e);for(const t of e){const n=i&&i[t.id]||{},s=t.options&&t.options[t.id]||{},r=t.deprecatedOptions&&t.deprecatedOptions[t.id]||{};Bu(n,t.id,s,r,e)}}function Bu(i,e,t,n,s){const r=e||"Top level",o=e?`${e}.`:"";for(const a in i){const c=!e&&gi(i[a]),l=a==="baseUri"&&!e,u=a==="workerUrl"&&e;if(!(a in t)&&!l&&!u){if(a in n)fs.level>0&&fs.warn(`${r} loader option '${o}${a}' no longer supported, use '${n[a]}'`)();else if(!c&&fs.level>0){const f=nb(a,s);fs.warn(`${r} loader option '${o}${a}' not recognized. ${f}`)()}}}}function nb(i,e){const t=i.toLowerCase();let n="";for(const s of e)for(const r in s.options){if(i===r)return`Did you mean '${s.id}.${r}'?`;const o=r.toLowerCase();(t.startsWith(o)||o.startsWith(t))&&(n=n||`Did you mean '${s.id}.${r}'?`)}return n}function sb(i,e,t){const n=i.options||{},s={...n};n.core&&(s.core={...n.core}),wg(s),s.core?.log===null&&(s.core={...s.core,log:new Q_}),Du(s,ci(xg()));const r=ci(e);return Du(s,r),rb(s,t),ab(s),s}function Du(i,e){for(const t in e)if(t in e){const n=e[t];Eu(n)&&Eu(i[t])?i[t]={...i[t],...e[t]}:i[t]=e[t]}}function rb(i,e){if(!e)return;i.core?.baseUrl!==void 0||(i.core||={},i.core.baseUrl=yg($r(e)))}function ob(i){const e={...i};return i.core&&(e.core={...i.core}),e}function wg(i){i.baseUri!==void 0&&(i.core||={},i.core.baseUrl===void 0&&(i.core.baseUrl=i.baseUri));for(const t of qc)if(i[t]!==void 0){const s=i.core=i.core||{};s[t]===void 0&&(s[t]=i[t])}const e=i._worker;e!==void 0&&(i.core||={},i.core._workerType===void 0&&(i.core._workerType=e))}function ab(i){const e=i.core;if(e)for(const t of qc)e[t]!==void 0&&(i[t]=e[t])}function Zc(i){return i?(Array.isArray(i)&&(i=i[0]),Array.isArray(i?.extensions)):!1}function Xc(i){fr(i,"null loader"),fr(Zc(i),"invalid loader");let e;return Array.isArray(i)&&(e=i[1],i=i[0],i={...i,options:{...i.options,...e}}),(i?.parseTextSync||i?.parseText)&&(i.text=!0),i.text||(i.binary=!0),i}const Pg=()=>{const i=vg();return i.loaderRegistry=i.loaderRegistry||[],i.loaderRegistry};function cb(i){const e=Pg();i=Array.isArray(i)?i:[i];for(const t of i){const n=Xc(t);e.find(s=>n===s)||e.unshift(n)}}function lb(){return Pg()}const ub=/\.([^.]+)$/;async function fb(i,e=[],t,n){if(!Sg(i))return null;const s=ci(t||{});if(s.core||={},i instanceof Response&&Fu(i)){const o=await i.clone().text(),a=ds(o,e,{...s,core:{...s.core,nothrow:!0}},n);if(a)return a}let r=ds(i,e,{...s,core:{...s.core,nothrow:!0}},n);if(r)return r;if(mi(i)&&(i=await i.slice(0,10).arrayBuffer(),r=ds(i,e,s,n)),!r&&i instanceof Response&&Fu(i)){const o=await i.clone().text();r=ds(o,e,s,n)}if(!r&&!s.core.nothrow)throw new Error(Eg(i));return r}function Fu(i){const e=Vr(i);return!!(e&&(e.startsWith("text/")||e==="application/json"||e.endsWith("+json")))}function ds(i,e=[],t,n){if(!Sg(i))return null;const s=ci(t||{});if(s.core||={},e&&!Array.isArray(e))return Xc(e);let r=[];e&&(r=r.concat(e)),s.core.ignoreRegisteredLoaders||r.push(...lb()),hb(r);const o=db(i,r,s,n);if(!o&&!s.core.nothrow)throw new Error(Eg(i));return o}function db(i,e,t,n){const s=Gr(i),r=Vr(i),o=$r(s)||n?.url;let a=null,c="";return t?.core?.mimeType&&(a=Io(e,t?.core?.mimeType),c=`match forced by supplied MIME type ${t?.core?.mimeType}`),a=a||gb(e,o),c=c||(a?`matched url ${o}`:""),a=a||Io(e,r),c=c||(a?`matched MIME type ${r}`:""),a=a||mb(e,i),c=c||(a?`matched initial data ${Cg(i)}`:""),t?.core?.fallbackMimeType&&(a=a||Io(e,t?.core?.fallbackMimeType),c=c||(a?`matched fallback MIME type ${r}`:"")),c&&c_.log(1,`selectLoader selected ${a?.name}: ${c}.`),a}function Sg(i){return!(i instanceof Response&&i.status===204)}function Eg(i){const e=Gr(i),t=Vr(i);let n="No valid loader found (";n+=e?`${mg(e)}, `:"no url provided, ",n+=`MIME type: ${t?`"${t}"`:"not provided"}, `;const s=i?Cg(i):"";return n+=s?` first bytes: "${s}"`:"first bytes: not available",n+=")",n}function hb(i){for(const e of i)Xc(e)}function gb(i,e){const t=e&&ub.exec(e),n=t&&t[1];return n?pb(i,n):null}function pb(i,e){e=e.toLowerCase();for(const t of i)for(const n of t.extensions)if(n.toLowerCase()===e)return t;return null}function Io(i,e){for(const t of i)if(t.mimeTypes?.some(n=>Ru(e,n))||Ru(e,`application/x.${t.id}`))return t;return null}function mb(i,e){if(!e)return null;for(const t of i)if(typeof e=="string"){if(yb(e,t))return t}else if(ArrayBuffer.isView(e)){if(zu(e.buffer,e.byteOffset,t))return t}else if(e instanceof ArrayBuffer&&zu(e,0,t))return t;return null}function yb(i,e){return e.testText?e.testText(i):(Array.isArray(e.tests)?e.tests:[e.tests]).some(n=>i.startsWith(n))}function zu(i,e,t){return(Array.isArray(t.tests)?t.tests:[t.tests]).some(s=>_b(i,e,t,s))}function _b(i,e,t,n){if(Hc(n))return M_(n,i,n.byteLength);switch(typeof n){case"function":return n(pg(i));case"string":const s=Va(i,e,n.length);return n===s;default:return!1}}function Cg(i,e=5){return typeof i=="string"?i.slice(0,e):ArrayBuffer.isView(i)?Va(i.buffer,i.byteOffset,e):i instanceof ArrayBuffer?Va(i,0,e):""}function Va(i,e,t){if(i.byteLength<e+t)return"";const n=new DataView(i);let s="";for(let r=0;r<t;r++)s+=String.fromCharCode(n.getUint8(e+r));return s}const bb=256*1024;function*vb(i,e){const t=e?.chunkSize||bb;let n=0;const s=new TextEncoder;for(;n<i.length;){const r=Math.min(i.length-n,t),o=i.slice(n,n+r);n+=r,yield pg(s.encode(o))}}const xb=256*1024;function*wb(i,e={}){const{chunkSize:t=xb}=e;let n=0;for(;n<i.byteLength;){const s=Math.min(i.byteLength-n,t),r=new ArrayBuffer(s),o=new Uint8Array(i,n,s);new Uint8Array(r).set(o),n+=s,yield r}}const Pb=1024*1024;async function*Sb(i,e){const t=e?.chunkSize||Pb;let n=0;for(;n<i.size;){const s=n+t,r=await i.slice(n,s).arrayBuffer();n=s,yield r}}function Nu(i,e){return jc?Eb(i,e):Cb(i)}async function*Eb(i,e){const t=i.getReader();let n;try{for(;;){const s=n||t.read();e?._streamReadAhead&&(n=t.read());const{done:r,value:o}=await s;if(r)return;yield Yc(o)}}catch{t.releaseLock()}}async function*Cb(i,e){for await(const t of i)yield Yc(t)}function Lb(i,e){if(typeof i=="string")return vb(i,e);if(i instanceof ArrayBuffer)return wb(i,e);if(mi(i))return Sb(i,e);if(ug(i))return Nu(i,e);if(pi(i)){const t=i.body;if(!t)throw new Error("Readable stream not available on Response");return Nu(t,e)}throw new Error("makeIterator")}const Lg="Cannot convert supplied data type";function Tb(i,e,t){if(e.text&&typeof i=="string")return i;if(gg(i)&&(i=i.buffer),Hc(i)){const n=F_(i);return e.text&&!e.binary?new TextDecoder("utf8").decode(n):Yc(n)}throw new Error(Lg)}async function Ab(i,e,t){if(typeof i=="string"||Hc(i))return Tb(i,e);if(mi(i)&&(i=await bg(i)),pi(i))return await W_(i),e.binary?await i.arrayBuffer():await i.text();if(ug(i)&&(i=Lb(i,t)),u_(i)||f_(i))return O_(i);throw new Error(Lg)}function Tg(i,e){const t=xg(),n=i||t,s=n.fetch??n.core?.fetch;return typeof s=="function"?s:gi(s)?r=>ku(r,s):e?.fetch?e?.fetch:ku}function Mb(i,e,t){if(t)return t;const n={fetch:Tg(e,i),...i};if(n.url){const s=$r(n.url);n.baseUrl=s,n.queryString=G_(n.url),n.filename=mg(s),n.baseUrl=yg(s)}return Array.isArray(n.loaders)||(n.loaders=null),n}function Ib(i,e){if(i&&!Array.isArray(i))return i;let t;if(i&&(t=Array.isArray(i)?i:[i]),e&&e.loaders){const n=Array.isArray(e.loaders)?e.loaders:[e.loaders];t=t?[...t,...n]:n}return t&&t.length?t:void 0}async function hr(i,e,t,n){e&&!Array.isArray(e)&&!Zc(e)&&(n=void 0,t=e,e=void 0),i=await i,t=t||{};const s=Gr(i),o=Ib(e,n),a=await fb(i,o,t);if(!a)return null;const c=tb(t,a,o,s);return n=Mb({url:s,_parse:hr,loaders:o},c,n||null),await Rb(a,i,c,n)}async function Rb(i,e,t,n){if(C_(i),t=g_(i.options,t),pi(e)){const{ok:r,redirected:o,status:a,statusText:c,type:l,url:u}=e,f=Object.fromEntries(e.headers.entries());n.response={headers:f,ok:r,redirected:o,status:a,statusText:c,type:l,url:u}}e=await Ab(e,i,t);const s=i;if(s.parseTextSync&&typeof e=="string")return s.parseTextSync(e,t,n);if(L_(i,t))return await T_(i,e,t,n,hr);if(s.parseText&&typeof e=="string")return await s.parseText(e,t,n);if(s.parse)return await s.parse(e,t,n);throw Gt(!s.parseSync),new Error(`${i.id} loader - no parser found and worker is disabled`)}function Ob(i){return ArrayBuffer.isView(i)&&!(i instanceof DataView)}function kb(i){return Array.isArray(i)?i.length===0||typeof i[0]=="number":!1}function Ag(i){return Ob(i)||kb(i)}async function gr(i,e,t,n){let s,r;!Array.isArray(e)&&!Zc(e)?(s=[],r=e):(s=e,r=t);const o=Tg(r);let a=i;return typeof i=="string"&&(a=await o(i)),mi(i)&&(a=await o(i)),typeof i=="string"&&(ci(r||{}).core?.baseUrl||(r={...r,core:{...r?.core,baseUrl:i}})),Array.isArray(s)?await hr(a,s,r):await hr(a,s,r)}const Bb="4.4.5",Db=globalThis.loaders?.parseImageNode,ja=typeof Image<"u",Wa=typeof ImageBitmap<"u",Fb=!!Db,Ha=jc?!0:Fb;function zb(i){switch(i){case"auto":return Wa||ja||Ha;case"imagebitmap":return Wa;case"image":return ja;case"data":return Ha;default:throw new Error(`@loaders.gl/images: image ${i} not supported in this environment`)}}function Nb(){if(Wa)return"imagebitmap";if(ja)return"image";if(Ha)return"data";throw new Error("Install '@loaders.gl/polyfills' to parse images under Node.js")}function Ub(i){const e=Gb(i);if(!e)throw new Error("Not an image");return e}function $b(i){switch(Ub(i)){case"data":return i;case"image":case"imagebitmap":const e=document.createElement("canvas"),t=e.getContext("2d");if(!t)throw new Error("getImageData");return e.width=i.width,e.height=i.height,t.drawImage(i,0,0),t.getImageData(0,0,i.width,i.height);default:throw new Error("getImageData")}}function Gb(i){return typeof ImageBitmap<"u"&&i instanceof ImageBitmap?"imagebitmap":typeof Image<"u"&&i instanceof Image?"image":i&&typeof i=="object"&&i.data&&i.width&&i.height?"data":null}const Vb=/^data:image\/svg\+xml/,jb=/\.svg((\?|#).*)?$/;function Kc(i){return i&&(Vb.test(i)||jb.test(i))}function Wb(i,e){if(Kc(e)){let n=new TextDecoder().decode(i);try{typeof unescape=="function"&&typeof encodeURIComponent=="function"&&(n=unescape(encodeURIComponent(n)))}catch(r){throw new Error(r.message)}return`data:image/svg+xml;base64,${btoa(n)}`}return Mg(i,e)}function Mg(i,e){if(Kc(e))throw new Error("SVG cannot be parsed directly to imagebitmap");return new Blob([new Uint8Array(i)])}async function Ig(i,e,t){const n=Wb(i,t),s=self.URL||self.webkitURL,r=typeof n!="string"&&s.createObjectURL(n);try{return await Hb(r||n,e)}finally{r&&s.revokeObjectURL(r)}}async function Hb(i,e){const t=new Image;return t.src=i,e.image&&e.image.decode&&t.decode?(await t.decode(),t):await new Promise((n,s)=>{try{t.onload=()=>n(t),t.onerror=r=>{const o=r instanceof Error?r.message:"error";s(new Error(o))}}catch(r){s(r)}})}let Uu=!0;async function Yb(i,e,t){let n;Kc(t)?n=await Ig(i,e,t):n=Mg(i,t);const s=e&&e.imagebitmap;return await qb(n,s)}async function qb(i,e=null){if((Zb(e)||!Uu)&&(e=null),e)try{return await createImageBitmap(i,e)}catch(t){console.warn(t),Uu=!1}return await createImageBitmap(i)}function Zb(i){if(!i)return!0;for(const e in i)if(Object.prototype.hasOwnProperty.call(i,e))return!1;return!0}function Xb(i){return!ev(i,"ftyp",4)||(i[8]&96)===0?null:Kb(i)}function Kb(i){switch(Qb(i,8,12).replace("\0"," ").trim()){case"avif":case"avis":return{extension:"avif",mimeType:"image/avif"};default:return null}}function Qb(i,e,t){return String.fromCharCode(...i.slice(e,t))}function Jb(i){return[...i].map(e=>e.charCodeAt(0))}function ev(i,e,t=0){const n=Jb(e);for(let s=0;s<n.length;++s)if(n[s]!==i[s+t])return!1;return!0}const lt=!1,An=!0;function Rg(i){const e=Jn(i);return iv(e)||rv(e)||nv(e)||sv(e)||tv(e)}function tv(i){const e=new Uint8Array(i instanceof DataView?i.buffer:i),t=Xb(e);return t?{mimeType:t.mimeType,width:0,height:0}:null}function iv(i){const e=Jn(i);return e.byteLength>=24&&e.getUint32(0,lt)===2303741511?{mimeType:"image/png",width:e.getUint32(16,lt),height:e.getUint32(20,lt)}:null}function nv(i){const e=Jn(i);return e.byteLength>=10&&e.getUint32(0,lt)===1195984440?{mimeType:"image/gif",width:e.getUint16(6,An),height:e.getUint16(8,An)}:null}function sv(i){const e=Jn(i);return e.byteLength>=14&&e.getUint16(0,lt)===16973&&e.getUint32(2,An)===e.byteLength?{mimeType:"image/bmp",width:e.getUint32(18,An),height:e.getUint32(22,An)}:null}function rv(i){const e=Jn(i);if(!(e.byteLength>=3&&e.getUint16(0,lt)===65496&&e.getUint8(2)===255))return null;const{tableMarkers:n,sofMarkers:s}=ov();let r=2;for(;r+9<e.byteLength;){const o=e.getUint16(r,lt);if(s.has(o))return{mimeType:"image/jpeg",height:e.getUint16(r+5,lt),width:e.getUint16(r+7,lt)};if(!n.has(o))return null;r+=2,r+=e.getUint16(r,lt)}return null}function ov(){const i=new Set([65499,65476,65484,65501,65534]);for(let t=65504;t<65520;++t)i.add(t);return{tableMarkers:i,sofMarkers:new Set([65472,65473,65474,65475,65477,65478,65479,65481,65482,65483,65485,65486,65487,65502])}}function Jn(i){if(i instanceof DataView)return i;if(ArrayBuffer.isView(i))return new DataView(i.buffer);if(i instanceof ArrayBuffer)return new DataView(i);throw new Error("toDataView")}async function av(i,e){const{mimeType:t}=Rg(i)||{},n=globalThis.loaders?.parseImageNode;return fr(n),await n(i,t)}async function cv(i,e,t){e=e||{};const s=(e.image||{}).type||"auto",{url:r}=t||{},o=lv(s);let a;switch(o){case"imagebitmap":a=await Yb(i,e,r);break;case"image":a=await Ig(i,e,r);break;case"data":a=await av(i);break;default:fr(!1)}return s==="data"&&(a=$b(a)),a}function lv(i){switch(i){case"auto":case"data":return Nb();default:return zb(i),i}}const uv=["png","jpg","jpeg","gif","webp","bmp","ico","svg","avif"],fv=["image/png","image/jpeg","image/gif","image/webp","image/avif","image/bmp","image/vnd.microsoft.icon","image/svg+xml"],dv={image:{type:"auto",decode:!0}},hv={dataType:null,batchType:null,id:"image",module:"images",name:"Images",version:Bb,mimeTypes:fv,extensions:uv,parse:cv,tests:[i=>!!Rg(new DataView(i))],options:dv},K=new Qn({id:"deck"});let Ya={};function gv(i){Ya=i}function Se(i,e,t,n){K.level>0&&Ya[i]&&Ya[i].call(null,e,t,n)}function pv(i){const e=i[0],t=i[i.length-1];return e==="{"&&t==="}"||e==="["&&t==="]"}const mv={dataType:null,batchType:null,id:"JSON",name:"JSON",module:"",version:"",options:{},extensions:["json","geojson"],mimeTypes:["application/json","application/geo+json"],testText:pv,parseTextSync:JSON.parse};function yv(){const i="9.4.0",e=globalThis.deck&&globalThis.deck.VERSION;if(e&&e!==i)throw new Error(`deck.gl - multiple versions detected: ${e} vs ${i}`);return e||(K.log(1,`deck.gl ${i}`)(),globalThis.deck={...globalThis.deck,VERSION:i,version:i,log:K,_registerLoggers:gv},cb([mv,[hv,{imagebitmap:{premultiplyAlpha:"none"}}]])),i}const _v=yv(),Ge="(?:var<\\s*(uniform|storage(?:\\s*,\\s*[A-Za-z_][A-Za-z0-9_]*)?)\\s*>|var)\\s+([A-Za-z_][A-Za-z0-9_]*)",Ve="\\s*",$n=[new RegExp(`@binding\\(\\s*(auto|\\d+)\\s*\\)${Ve}@group\\(\\s*(\\d+)\\s*\\)${Ve}${Ge}`,"g"),new RegExp(`@group\\(\\s*(\\d+)\\s*\\)${Ve}@binding\\(\\s*(auto|\\d+)\\s*\\)${Ve}${Ge}`,"g")],qa=[new RegExp(`@binding\\(\\s*(auto|\\d+)\\s*\\)${Ve}@group\\(\\s*(\\d+)\\s*\\)${Ve}${Ge}`,"g"),new RegExp(`@group\\(\\s*(\\d+)\\s*\\)${Ve}@binding\\(\\s*(auto|\\d+)\\s*\\)${Ve}${Ge}`,"g")],bv=[new RegExp(`@binding\\(\\s*(\\d+)\\s*\\)${Ve}@group\\(\\s*(\\d+)\\s*\\)${Ve}${Ge}`,"g"),new RegExp(`@group\\(\\s*(\\d+)\\s*\\)${Ve}@binding\\(\\s*(\\d+)\\s*\\)${Ve}${Ge}`,"g")],vv=[new RegExp(`@binding\\(\\s*(auto)\\s*\\)\\s*@group\\(\\s*(\\d+)\\s*\\)\\s*${Ge}`,"g"),new RegExp(`@group\\(\\s*(\\d+)\\s*\\)\\s*@binding\\(\\s*(auto)\\s*\\)\\s*${Ge}`,"g"),new RegExp(`@binding\\(\\s*(auto)\\s*\\)\\s*@group\\(\\s*(\\d+)\\s*\\)(?:[\\s\\n\\r]*@[A-Za-z_][^\\n\\r]*)*[\\s\\n\\r]*${Ge}`,"g"),new RegExp(`@group\\(\\s*(\\d+)\\s*\\)\\s*@binding\\(\\s*(auto)\\s*\\)(?:[\\s\\n\\r]*@[A-Za-z_][^\\n\\r]*)*[\\s\\n\\r]*${Ge}`,"g")];function jr(i){const e=i.split("");let t=0,n=0,s=!1,r=!1,o=!1;for(;t<i.length;){const a=i[t],c=i[t+1];if(r){o?o=!1:a==="\\"?o=!0:a==='"'&&(r=!1),t++;continue}if(s){a===`
`||a==="\r"?s=!1:e[t]=" ",t++;continue}if(n>0){if(a==="/"&&c==="*"){e[t]=" ",e[t+1]=" ",n++,t+=2;continue}if(a==="*"&&c==="/"){e[t]=" ",e[t+1]=" ",n--,t+=2;continue}a!==`
`&&a!=="\r"&&(e[t]=" "),t++;continue}if(a==='"'){r=!0,t++;continue}if(a==="/"&&c==="/"){e[t]=" ",e[t+1]=" ",s=!0,t+=2;continue}if(a==="/"&&c==="*"){e[t]=" ",e[t+1]=" ",n=1,t+=2;continue}t++}return e.join("")}function en(i,e){const t=jr(i),n=[];for(const s of e){s.lastIndex=0;let r;for(r=s.exec(t);r;){const o=s===e[0],a=r.index,c=r[0].length;n.push({match:i.slice(a,a+c),index:a,length:c,bindingToken:r[o?1:2],groupToken:r[o?2:1],accessDeclaration:r[3]?.trim(),name:r[4]}),r=s.exec(t)}}return n.sort((s,r)=>s.index-r.index)}function Og(i,e,t){const n=en(i,e);if(!n.length)return i;let s="",r=0;for(const o of n)s+=i.slice(r,o.index),s+=t(o),r=o.index+o.length;return s+=i.slice(r),s}function kg(i){return/@binding\(\s*auto\s*\)/.test(jr(i))}function xv(i,e){return en(i,e===$n||e===qa?vv:e).find(n=>n.bindingToken==="auto")}function Bg(i,e={}){const t=Dg(i),n=wv(t);if(!n)return null;const s=Pv(t,n);if(!s)return null;const r=Ev(t,n,s);if(!r)return null;if(e.scanVertexAttributes===!1)return{attributes:[],bindings:r};const o=Sv(t,n);if(!o)return null;const a=Mv(t,n,s,o,e.vertexEntryPoint);return a?{attributes:a,bindings:r}:null}function Dg(i){const e=jr(i),t=/[A-Za-z_][A-Za-z0-9_]*|(?:0[xX][0-9A-Fa-f]+|\d+)|[@(){}<>\[\]:,;=]/g,n=[];let s=t.exec(e);for(;s;)n.push({value:s[0],index:s.index}),s=t.exec(e);return n}function wv(i){const e=[];let t=0;for(const n of i){if(n.value==="}"&&t===0)return null;e.push(t),n.value==="{"?t++:n.value==="}"&&t--}return t===0?e:null}function Pv(i,e){const t=new Map;for(let n=0;n<i.length;n++){if(e[n]!==0||i[n].value!=="alias")continue;const s=i[n+1]?.value;if(!es(s)||i[n+2]?.value!=="="||t.has(s))return null;const r=Ng(i,e,n+3,";");if(r<0||r===n+3)return null;t.set(s,pr(i.slice(n+3,r))),n=r}return t}function Sv(i,e){const t=new Map;for(let n=0;n<i.length;n++){if(e[n]!==0||i[n].value!=="struct")continue;const s=i[n+1]?.value,r=n+2;if(!es(s)||t.has(s)||i[r]?.value!=="{")return null;const o=Jc(i,r,"{","}");if(o<0)return null;t.set(s,i.slice(r+1,o)),n=o}return t}function Ev(i,e,t){const n=[],s=new Set,r=new Set;for(let o=0;o<i.length;o++){if(e[o]!==0||i[o].value!=="var")continue;const a=Ug(i,e,o),c=i.slice(a,o),l=Za(c,"group"),u=Za(c,"binding");if(l===null||u===null||l===void 0!=(u===void 0))return null;if(l===void 0||u===void 0)continue;let f=o+1,d=[];if(i[f]?.value==="<"){const v=Jc(i,f,"<",">");if(v<0)return null;const b=Wr(i.slice(f+1,v),",");if(!b)return null;d=b.map(pr),f=v+1}const h=i[f]?.value;if(!es(h)||i[f+1]?.value!==":")return null;const g=Ng(i,e,f+2,";");if(g<0||g===f+2)return null;const p=Qc(pr(i.slice(f+2,g)),t);if(!p)return null;const m=Cv({name:h,group:l,location:u,addressSpace:d,resourceType:p}),_=`${l}:${u}`;if(!m||s.has(_)||r.has(h))return null;n.push(m),s.add(_),r.add(h),o=g}return Av(n),n.sort((o,a)=>o.group-a.group||o.location-a.location||o.name.localeCompare(a.name))}function Cv(i){const{name:e,group:t,location:n,addressSpace:s,resourceType:r}=i,o={name:e,group:t,location:n};if(s[0]==="uniform"&&s.length===1)return{...o,type:"uniform"};if(s[0]==="storage"&&s.length<=2){const a=s[1]||"read";return a==="read"?{...o,type:"read-only-storage"}:a==="read_write"?{...o,type:"storage"}:null}return s.length>0?null:r==="sampler"||r==="sampler_comparison"?{...o,type:"sampler",...r==="sampler_comparison"?{samplerType:"comparison"}:{}}:r==="texture_external"?{...o,type:"external-texture"}:Lv(o,r)||Tv(o,r)}function Lv(i,e){const t=/^texture_storage_(1d|2d|2d_array|3d)<([A-Za-z0-9_]+),(read|write|read_write)>$/.exec(e);if(!t)return null;const n={read:"read-only",write:"write-only",read_write:"read-write"}[t[3]];return{...i,type:"storage",format:t[2],access:n,viewDimension:Xa(t[1])}}function Tv(i,e){const t=/^texture_(multisampled_)?(1d|2d|2d_array|cube|cube_array|3d)<(f32|i32|u32)>$/.exec(e);if(t){if(t[1]&&t[2]!=="2d")return null;const s={f32:"float",i32:"sint",u32:"uint"}[t[3]];return{...i,type:"texture",viewDimension:Xa(t[2]),sampleType:s,multisampled:!!t[1]}}const n=/^texture_depth_(multisampled_)?(2d|2d_array|cube|cube_array)$/.exec(e);return!n||n[1]&&n[2]!=="2d"?null:{...i,type:"texture",viewDimension:Xa(n[2]),sampleType:"depth",multisampled:!!n[1]}}function Av(i){for(const e of i){if(e.type!=="sampler"||e.samplerType||!e.name.endsWith("Sampler"))continue;const t=e.name.slice(0,-7);i.find(s=>s.type==="texture"&&s.name===t&&s.group===e.group)?.sampleType==="depth"&&(e.samplerType="non-filtering")}}function Mv(i,e,t,n,s){const r=Iv(i,e);if(!r)return null;const o=r.filter(h=>h.vertex),a=s?o.find(h=>h.name===s):o.length===1?o[0]:void 0;if(!a)return o.length===0&&!s?[]:null;const c=Wr(a.parameters,",");if(!c)return null;const l=[],u=new Set,f=new Set,d=new Set;for(const h of c)if(h.length>0&&!Fg({declaration:h,aliases:t,structures:n,attributes:l,attributeLocations:u,attributeNames:f,visitedStructures:d}))return null;return l.sort((h,g)=>h.location-g.location||h.name.localeCompare(g.name))}function Iv(i,e){const t=[],n=new Set;for(let s=0;s<i.length;s++){if(e[s]!==0||i[s].value!=="fn")continue;const r=i[s+1]?.value,o=s+2;if(!es(r)||n.has(r)||i[o]?.value!=="(")return null;const a=Jc(i,o,"(",")");if(a<0)return null;const c=Ug(i,e,s);t.push({name:r,vertex:zg(i.slice(c,s),"vertex"),parameters:i.slice(o+1,a)}),n.add(r),s=a}return t}function Fg(i){const{declaration:e,aliases:t,structures:n,attributes:s,attributeLocations:r,attributeNames:o,visitedStructures:a}=i,c=kv(e,":");if(c<1||c===e.length-1)return!1;const l=Bv(e.slice(0,c)),u=Za(e.slice(0,c),"location"),f=zg(e.slice(0,c),"builtin"),d=Qc(pr(e.slice(c+1)),t);if(!l||u===null||!d||u!==void 0&&f)return!1;if(u!==void 0){const p=Ov(d);return!p||r.has(u)||o.has(l)?!1:(s.push({name:l,location:u,type:p}),r.add(u),o.add(l),!0)}if(f)return!0;const h=n.get(d);if(!h||a.has(d))return!1;const g=Wr(h,",");if(!g)return!1;a.add(d);for(const p of g)if(p.length>0&&!Fg({...i,declaration:p}))return!1;return a.delete(d),!0}function Qc(i,e,t=new Set){const n=Dg(i);let s="";for(const r of n){const o=e.get(r.value);if(!o){s+=Rv(r.value);continue}if(t.has(r.value))return null;const a=new Set(t);a.add(r.value);const c=Qc(o,e,a);if(!c)return null;s+=c}return s}function Rv(i){const e=/^(vec[234]|mat[234]x[234])([fiuh])$/.exec(i);if(!e)return i;const t={f:"f32",i:"i32",u:"u32",h:"f16"}[e[2]];return`${e[1]}<${t}>`}function Ov(i){return/^(?:i32|u32|f32|f16|vec[234]<(?:i32|u32|f32|f16)>)$/.test(i)?i:null}function Za(i,e){let t;for(let n=0;n<i.length;n++)if(!(i[n].value!=="@"||i[n+1]?.value!==e)){if(t!==void 0||i[n+2]?.value!=="("||!/^\d+$/.test(i[n+3]?.value||"")||i[n+4]?.value!==")")return null;t=Number(i[n+3].value)}return t}function zg(i,e){return i.some((t,n)=>t.value==="@"&&i[n+1]?.value===e)}function Xa(i){return i.replace("_","-")}function Jc(i,e,t,n){let s=0;for(let r=e;r<i.length;r++)if(i[r].value===t)s++;else if(i[r].value===n&&--s===0)return r;return-1}function Wr(i,e){const t=[];let n=0;const s={"(":0,"<":0,"[":0,"{":0},r=Object.keys(s),o={")":"(",">":"<","]":"[","}":"{"};for(let a=0;a<i.length;a++){const c=i[a].value;if(c===e&&r.every(l=>s[l]===0)){t.push(i.slice(n,a)),n=a+1;continue}if(c in s)s[c]++;else if(c in o){const l=o[c];if(s[l]--,s[l]<0)return null}}return r.every(a=>s[a]===0)?(t.push(i.slice(n)),t):null}function kv(i,e){const t=Wr(i,e);return t&&t.length===2?t[0].length:-1}function Ng(i,e,t,n){for(let s=t;s<i.length;s++)if(e[s]===0&&i[s].value===n)return s;return-1}function Ug(i,e,t){for(let n=t-1;n>=0;n--)if(i[n].value===";"&&e[n]===0||i[n].value==="}"&&e[n]===1)return n+1;return 0}function Bv(i){for(let e=i.length-1;e>=0;e--)if(es(i[e].value))return i[e].value;return null}function pr(i){return i.map(e=>e.value).join("")}function es(i){return!!(i&&/^[A-Za-z_][A-Za-z0-9_]*$/.test(i))}function tn(i,e){if(!i){const t=new Error(e||"shadertools: assertion failed.");throw Error.captureStackTrace?.(t,tn),t}}const Ro={number:{type:"number",validate(i,e){return Number.isFinite(i)&&typeof e=="object"&&(e.max===void 0||i<=e.max)&&(e.min===void 0||i>=e.min)}},array:{type:"array",validate(i,e){return Array.isArray(i)||ArrayBuffer.isView(i)}}};function Dv(i){const e={};for(const[t,n]of Object.entries(i))e[t]=Fv(n);return e}function Fv(i){let e=$u(i);if(e!=="object")return{value:i,...Ro[e],type:e};if(typeof i=="object")return i?i.type!==void 0?{...i,...Ro[i.type],type:i.type}:i.value===void 0?{type:"object",value:i}:(e=$u(i.value),{...i,...Ro[e],type:e}):{type:"object",value:null};throw new Error("props")}function $u(i){return Array.isArray(i)||ArrayBuffer.isView(i)?"array":typeof i}const zv=`#ifdef MODULE_LOGDEPTH
  logdepth_adjustPosition(gl_Position);
#endif
`,Nv=`#ifdef MODULE_MATERIAL
  fragColor = material_filterColor(fragColor);
#endif

#ifdef MODULE_LIGHTING
  fragColor = lighting_filterColor(fragColor);
#endif

#ifdef MODULE_FOG
  fragColor = fog_filterColor(fragColor);
#endif

#ifdef MODULE_PICKING
  fragColor = picking_filterHighlightColor(fragColor);
  fragColor = picking_filterPickingColor(fragColor);
#endif

#ifdef MODULE_LOGDEPTH
  logdepth_setFragDepth();
#endif
`,Uv={vertex:zv,fragment:Nv},Gu=/void\s+main\s*\([^)]*\)\s*\{\n?/,Vu=/}\n?[^{}]*$/,Oo=[],Us="__LUMA_INJECT_DECLARATIONS__";function $v(i){const e={vertex:{},fragment:{}};for(const t in i){let n=i[t];const s=Gv(t);typeof n=="string"&&(n={order:0,injection:n}),e[s][t]=n}return e}function Gv(i){const e=i.slice(0,2);switch(e){case"vs":return"vertex";case"fs":return"fragment";default:throw new Error(e)}}function mr(i,e,t,n=!1,s="glsl",r={}){const o=e==="vertex";for(const a in t){const c=t[a];c.sort((u,f)=>u.order-f.order),Oo.length=c.length;for(let u=0,f=c.length;u<f;++u)Oo[u]=c[u].injection;const l=`${Oo.join(`
`)}
`;switch(a){case"vs:#decl":(s==="wgsl"||o)&&(i=i.replace(Us,l));break;case"vs:#main-start":(s==="wgsl"||o)&&(i=s==="wgsl"?hs(i,"vertex",l,"start",r.vertex):i.replace(Gu,u=>u+l));break;case"vs:#main-end":(s==="wgsl"||o)&&(i=s==="wgsl"?hs(i,"vertex",l,"end",r.vertex):i.replace(Vu,u=>l+u));break;case"fs:#decl":(s==="wgsl"||!o)&&(i=i.replace(Us,l));break;case"fs:#main-start":(s==="wgsl"||!o)&&(i=s==="wgsl"?hs(i,"fragment",l,"start",r.fragment):i.replace(Gu,u=>u+l));break;case"fs:#main-end":(s==="wgsl"||!o)&&(i=s==="wgsl"?hs(i,"fragment",l,"end",r.fragment):i.replace(Vu,u=>l+u));break;default:i=i.replace(a,u=>u+l)}}return i=i.replace(Us,""),n&&(i=i.replace(/\}\s*$/,a=>a+Uv[e])),i}function hs(i,e,t,n,s){const r=Vv(i,e,s);if(!r)return i;if(n==="start"){const o=r.openBraceIndex+1;return`${i.slice(0,o)}
${t}${i.slice(o)}`}return`${i.slice(0,r.closeBraceIndex)}${t}${i.slice(r.closeBraceIndex)}`}function Vv(i,e,t){const n=e==="vertex"?"@vertex":"@fragment",s=i.indexOf(n);if(s<0)return null;const r=t?i.search(new RegExp(`\\bfn\\s+${jv(t)}\\s*\\(`)):i.indexOf("fn",s);if(r<0)return null;const o=i.indexOf("{",r);if(o<0)return null;let a=0;for(let c=o;c<i.length;c++){const l=i[c];if(l==="{")a++;else if(l==="}"&&(a--,a===0))return{openBraceIndex:o,closeBraceIndex:c}}return null}function jv(i){return i.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")}function yr(i){i.map(e=>Wv(e))}function Wv(i){if(i.instance)return;yr(i.dependencies||[]);const{propTypes:e={},deprecations:t=[],inject:n={}}=i,s={normalizedInjections:$v(n),parsedDeprecations:Hv(t)};e&&(s.propValidators=Dv(e)),i.instance=s;let r={};e&&(r=Object.entries(e).reduce((o,[a,c])=>{const l=c?.value;return l&&(o[a]=l),o},{})),i.defaultUniforms={...i.defaultUniforms,...r}}function $g(i,e,t){i.deprecations?.forEach(n=>{n.regex?.test(e)&&(n.deprecated?t.deprecated(n.old,n.new)():t.removed(n.old,n.new)())})}function Hv(i){return i.forEach(e=>{e.type==="function"?e.regex=new RegExp(`\\b${e.old}\\(`):e.regex=new RegExp(`${e.type} ${e.old};`)}),i}function _r(i){yr(i);const e={},t={};Gg({modules:i,level:0,moduleMap:e,moduleDepth:t});const n=Object.keys(t).sort((s,r)=>t[r]-t[s]).map(s=>e[s]);return yr(n),n}function Gg(i){const{modules:e,level:t,moduleMap:n,moduleDepth:s}=i;if(t>=5)throw new Error("Possible loop in shader dependency graph");for(const r of e)n[r.name]=r,(s[r.name]===void 0||s[r.name]<t)&&(s[r.name]=t);for(const r of e)r.dependencies&&Gg({modules:r.dependencies,level:t+1,moduleMap:n,moduleDepth:s})}const A=new Qn({id:"luma.gl"}),Vg={id:null,powerPreference:"high-performance",failIfMajorPerformanceCaveat:!1,featureLevel:void 0,optionalFeatures:[],xrCompatible:!1,createCanvasContext:void 0,webgl:{},onError:(i,e)=>{},onResize:(i,e)=>{const[t,n]=i.getDevicePixelSize();A.log(1,`${i} resized => ${t}x${n}px`)()},onPositionChange:(i,e)=>{const[t,n]=i.getPosition();A.log(1,`${i} repositioned => ${t},${n}`)()},onVisibilityChange:i=>A.log(1,`${i} Visibility changed ${i.isVisible}`)(),onDevicePixelRatioChange:(i,e)=>A.log(1,`${i} DPR changed ${e.oldRatio} => ${i.devicePixelRatio}`)(),debug:qv(),debugGPUTime:!1,debugShaders:A.get("debug-shaders")||void 0,debugFramebuffers:!!A.get("debug-framebuffers"),debugFactories:!!A.get("debug-factories"),debugWebGL:!!A.get("debug-webgl"),debugSpectorJS:void 0,debugSpectorJSUrl:void 0,_reuseDevices:!1,_cacheShaders:!0,_destroyShaders:!1,_cachePipelines:!0,_sharePipelines:!0,_destroyPipelines:!1,_initializeFeatures:!0,_disabledFeatures:{"compilation-status-async-webgl":!0},_handle:void 0};function Yv(i,e){return i!=null?!!i:e!==void 0?e!=="production":!1}function qv(){return Yv(A.get("debug"),Zv())}function Zv(){const i=globalThis.process;if(i?.env)return i.env.NODE_ENV}const Xv="GPU Time and Memory",Kv=["Adapter","GPU","GPU Type","GPU Backend","Frame Rate","CPU Time","GPU Time","GPU Memory","Buffer Memory","Texture Memory","External Buffer Memory","External Texture Memory","Swap Chain Texture"],ju=new WeakMap,Wu=new WeakMap;class Qv{stats=new Map;getStats(e){return this.get(e)}get(e){this.stats.has(e)||this.stats.set(e,new Ur({id:e}));const t=this.stats.get(e);return e===Xv&&Jv(t,Kv),t}}const jg=new Qv;function Jv(i,e){const t=i.stats;let n=!1;for(const c of e)t[c]||(i.get(c),n=!0);const s=Object.keys(t).length,r=ju.get(i);if(!n&&r?.orderedStatNames===e&&r.statCount===s)return;const o={};let a=Wu.get(e);a||(a=new Set(e),Wu.set(e,a));for(const c of e)t[c]&&(o[c]=t[c]);for(const[c,l]of Object.entries(t))a.has(c)||(o[c]=l);for(const c of Object.keys(t))delete t[c];Object.assign(t,o),ju.set(i,{orderedStatNames:e,statCount:s})}const e0="set luma.log.level=1 (or higher) to trace rendering",Hu="No matching device found. Ensure `@luma.gl/webgl` and/or `@luma.gl/webgpu` modules are imported.";class br{static defaultProps={...Vg,type:"best-available",adapters:void 0,waitForPageLoad:!0};stats=jg;log=A;VERSION="9.4.0";spector;preregisteredAdapters=new Map;constructor(){if(globalThis.luma){if(globalThis.luma.VERSION!==this.VERSION)throw A.error(`Found luma.gl ${globalThis.luma.VERSION} while initialzing ${this.VERSION}`)(),A.error("'yarn why @luma.gl/core' can help identify the source of the conflict")(),new Error("luma.gl - multiple versions detected: see console log");A.error("This version of luma.gl has already been initialized")()}A.log(1,`${this.VERSION} - ${e0}`)(),globalThis.luma=this}async createDevice(e={}){const t={...br.defaultProps,...e},n=this.selectAdapter(t.type,t.adapters);if(!n)throw new Error(Hu);return t.waitForPageLoad&&await n.pageLoaded,await n.create(t)}async attachDevice(e,t){const n=this._getTypeFromHandle(e,t.adapters),s=n&&this.selectAdapter(n,t.adapters);if(!s)throw new Error(Hu);return await s?.attach?.(e,t)}registerAdapters(e){for(const t of e)this.preregisteredAdapters.set(t.type,t)}getSupportedAdapters(e=[]){const t=this._getAdapterMap(e);return Array.from(t).map(([,n])=>n).filter(n=>n.isSupported?.()).map(n=>n.type)}getBestAvailableAdapterType(e=[]){const t=["webgpu","webgl","null"],n=this._getAdapterMap(e);for(const s of t)if(n.get(s)?.isSupported?.())return s;return null}selectAdapter(e,t=[]){let n=e;e==="best-available"&&(n=this.getBestAvailableAdapterType(t));const s=this._getAdapterMap(t);return n&&s.get(n)||null}enforceWebGL2(e=!0,t=[]){const s=this._getAdapterMap(t).get("webgl");s||A.warn("enforceWebGL2: webgl adapter not found")(),s?.enforceWebGL2?.(e)}setDefaultDeviceProps(e){Object.assign(br.defaultProps,e)}_getAdapterMap(e=[]){const t=new Map(this.preregisteredAdapters);for(const n of e)t.set(n.type,n);return t}_getTypeFromHandle(e,t=[]){return e instanceof WebGL2RenderingContext?"webgl":typeof GPUDevice<"u"&&e instanceof GPUDevice||e?.queue?"webgpu":e===null?"null":(e instanceof WebGLRenderingContext?A.warn("WebGL1 is not supported",e)():A.warn("Unknown handle type",e)(),null)}}const Ka=new br;class t0{get pageLoaded(){return s0()}}const i0=Ji()&&typeof document<"u",n0=()=>i0&&document.readyState==="complete";let gs=null;function s0(){return gs||(n0()||typeof window>"u"?gs=Promise.resolve():gs=new Promise(i=>window.addEventListener("load",()=>i()))),gs}const ko={};function ts(i="id"){ko[i]=ko[i]||1;const e=ko[i]++;return`${i}-${e}`}const r0="cpu-hotspot-profiler",Yu="GPU Resource Counts",qu="Resource Counts",Zu="GPU Time and Memory",o0=["Resources","Buffers","Textures","Samplers","TextureViews","Framebuffers","QuerySets","Shaders","RenderPipelines","ComputePipelines","PipelineLayouts","VertexArrays","RenderPasss","RenderBundleEncoders","RenderBundles","ComputePasss","CommandEncoders","CommandBuffers"],a0=["Resources","Buffers","Textures","Samplers","TextureViews","Framebuffers","QuerySets","Shaders","RenderPipelines","SharedRenderPipelines","ComputePipelines","PipelineLayouts","VertexArrays","RenderPasss","RenderBundleEncoders","RenderBundles","ComputePasss","CommandEncoders","CommandBuffers"],c0=o0.flatMap(i=>[`${i} Created`,`${i} Active`]),l0=a0.flatMap(i=>[`${i} Created`,`${i} Active`]),Xu=new WeakMap,Ku=new WeakMap;let Q=class{static defaultProps={id:"undefined",handle:void 0,_isHandleBorrowed:!1,userData:void 0};toString(){return`${this[Symbol.toStringTag]||this.constructor.name}:"${this.id}"`}toJSON(){return this.toString()}id;props;userData={};_device;destroyed=!1;allocatedBytes=0;allocatedBytesName=null;_attachedResources=new Set;get ownsHandle(){return(this.props.handle===void 0||this.props.handle===null)&&!this.isHandleBorrowed}get isHandleBorrowed(){return!!this.props._isHandleBorrowed}constructor(e,t,n){if(!e)throw new Error("no device");this._device=e,this.props=u0(t,n);const s=this.props.id!=="undefined"?this.props.id:ts(this[Symbol.toStringTag]);this.props.id=s,this.id=s,this.userData=this.props.userData||{},this.addStats()}destroy(){this.destroyed||this.destroyResource()}delete(){return this.destroy(),this}getProps(){return this.props}attachResource(e){this._attachedResources.add(e)}detachResource(e){this._attachedResources.delete(e)}destroyAttachedResource(e){this._attachedResources.delete(e)&&e.destroy()}destroyAttachedResources(){for(const e of this._attachedResources)e.destroy();this._attachedResources=new Set}destroyResource(){this.destroyed||(this.destroyAttachedResources(),this.removeStats(),this.destroyed=!0)}removeStats(){const e=Sn(this._device),t=e?Tt():0,n=[this._device.statsManager.getStats(Yu),this._device.statsManager.getStats(qu)],s=Ju(this._device);for(const o of n)Qu(o,s);const r=this.getStatsName();for(const o of n)o.get("Resources Active").decrementCount(),o.get(`${r}s Active`).decrementCount();e&&(e.statsBookkeepingCalls=(e.statsBookkeepingCalls||0)+1,e.statsBookkeepingTimeMs=(e.statsBookkeepingTimeMs||0)+(Tt()-t))}trackAllocatedMemory(e,t=this.getStatsName()){const n=Sn(this._device),s=n?Tt():0,r=this._device.statsManager.getStats(Zu);this.allocatedBytes>0&&this.allocatedBytesName&&(r.get("GPU Memory").subtractCount(this.allocatedBytes),r.get(`${this.allocatedBytesName} Memory`).subtractCount(this.allocatedBytes)),r.get("GPU Memory").addCount(e),r.get(`${t} Memory`).addCount(e),n&&(n.statsBookkeepingCalls=(n.statsBookkeepingCalls||0)+1,n.statsBookkeepingTimeMs=(n.statsBookkeepingTimeMs||0)+(Tt()-s)),this.allocatedBytes=e,this.allocatedBytesName=t}trackReferencedMemory(e,t=this.getStatsName()){this.trackAllocatedMemory(e,`External ${t}`)}trackDeallocatedMemory(e=this.getStatsName()){if(this.allocatedBytes===0){this.allocatedBytesName=null;return}const t=Sn(this._device),n=t?Tt():0,s=this._device.statsManager.getStats(Zu);s.get("GPU Memory").subtractCount(this.allocatedBytes),s.get(`${this.allocatedBytesName||e} Memory`).subtractCount(this.allocatedBytes),t&&(t.statsBookkeepingCalls=(t.statsBookkeepingCalls||0)+1,t.statsBookkeepingTimeMs=(t.statsBookkeepingTimeMs||0)+(Tt()-n)),this.allocatedBytes=0,this.allocatedBytesName=null}trackDeallocatedReferencedMemory(e=this.getStatsName()){this.trackDeallocatedMemory(`Referenced ${e}`)}addStats(){const e=this.getStatsName(),t=Sn(this._device),n=t?Tt():0,s=[this._device.statsManager.getStats(Yu),this._device.statsManager.getStats(qu)],r=Ju(this._device);for(const o of s)Qu(o,r);for(const o of s)o.get("Resources Created").incrementCount(),o.get("Resources Active").incrementCount(),o.get(`${e}s Created`).incrementCount(),o.get(`${e}s Active`).incrementCount();t&&(t.statsBookkeepingCalls=(t.statsBookkeepingCalls||0)+1,t.statsBookkeepingTimeMs=(t.statsBookkeepingTimeMs||0)+(Tt()-n)),f0(this._device,e)}getStatsName(){return d0(this)}};function u0(i,e){const t={...e};for(const n in i)i[n]!==void 0&&(t[n]=i[n]);return t}function Qu(i,e){const t=i.stats;let n=!1;for(const c of e)t[c]||(i.get(c),n=!0);const s=Object.keys(t).length,r=Xu.get(i);if(!n&&r?.orderedStatNames===e&&r.statCount===s)return;const o={};let a=Ku.get(e);a||(a=new Set(e),Ku.set(e,a));for(const c of e)t[c]&&(o[c]=t[c]);for(const[c,l]of Object.entries(t))a.has(c)||(o[c]=l);for(const c of Object.keys(t))delete t[c];Object.assign(t,o),Xu.set(i,{orderedStatNames:e,statCount:s})}function Ju(i){return i.type==="webgl"?l0:c0}function Sn(i){const e=i.userData[r0];return e?.enabled?e:null}function Tt(){return globalThis.performance?.now?.()??Date.now()}function f0(i,e){const t=Sn(i);if(!(!t||!t.activeDefaultFramebufferAcquireDepth))switch(t.transientCanvasResourceCreates=(t.transientCanvasResourceCreates||0)+1,e){case"Texture":t.transientCanvasTextureCreates=(t.transientCanvasTextureCreates||0)+1;break;case"TextureView":t.transientCanvasTextureViewCreates=(t.transientCanvasTextureViewCreates||0)+1;break;case"Sampler":t.transientCanvasSamplerCreates=(t.transientCanvasSamplerCreates||0)+1;break;case"Framebuffer":t.transientCanvasFramebufferCreates=(t.transientCanvasFramebufferCreates||0)+1;break}}function d0(i){let e=Object.getPrototypeOf(i);for(;e;){const t=Object.getPrototypeOf(e);if(!t||t===Q.prototype)return h0(e)||i[Symbol.toStringTag]||i.constructor.name;e=t}return i[Symbol.toStringTag]||i.constructor.name}function h0(i){const e=Object.getOwnPropertyDescriptor(i,Symbol.toStringTag);return typeof e?.get=="function"?e.get.call(i):typeof e?.value=="string"?e.value:null}class q extends Q{static INDEX=16;static VERTEX=32;static UNIFORM=64;static STORAGE=128;static INDIRECT=256;static QUERY_RESOLVE=512;static MAP_READ=1;static MAP_WRITE=2;static COPY_SRC=4;static COPY_DST=8;get[Symbol.toStringTag](){return"Buffer"}usage;indexType;updateTimestamp;constructor(e,t){const n={...t};(t.usage||0)&q.INDEX&&!t.indexType&&(t.data instanceof Uint32Array?n.indexType="uint32":t.data instanceof Uint16Array?n.indexType="uint16":t.data instanceof Uint8Array&&(n.indexType="uint8")),delete n.data,super(e,n,q.defaultProps),this.usage=n.usage||0,this.indexType=n.indexType,this.updateTimestamp=e.incrementTimestamp()}clone(e){return this.device.createBuffer({...this.props,...e})}static DEBUG_DATA_MAX_LENGTH=32;debugData=new ArrayBuffer(0);_setDebugData(e,t,n){if(!this.device.props.debug)return;let s=null,r;ArrayBuffer.isView(e)?(s=e,r=e.buffer):r=e;const o=Math.min(e?e.byteLength:n,q.DEBUG_DATA_MAX_LENGTH);if(r===null)this.debugData=new ArrayBuffer(o);else{const a=Math.min(s?.byteOffset||0,r.byteLength),c=Math.max(0,r.byteLength-a),l=Math.min(o,c);this.debugData=new Uint8Array(r,a,l).slice().buffer}}static defaultProps={...Q.defaultProps,handle:void 0,usage:0,byteLength:0,byteOffset:0,data:null,indexType:"uint16",onMapped:void 0}}const Qa=globalThis.Float16Array;function g0(){return Qa??Uint16Array}function p0(i){return!!(Qa&&i===Qa)}function m0(i){const e=i.includes("norm"),t=!e&&!i.startsWith("float"),n=i.startsWith("s"),s=tl[i],[r,o,a]=s||["uint8 ","i32",1];return{signedType:r,primitiveType:o,byteLength:a,normalized:e,integer:t,signed:n}}function y0(i){const e=i;switch(e){case"uint8":return"unorm8";case"sint8":return"snorm8";case"uint16":return"unorm16";case"sint16":return"snorm16";default:return e}}function ut(i,e){switch(e){case 1:return i;case 2:return i+i%2;default:return i+(4-i%4)%4}}function Wg(i){const e=ArrayBuffer.isView(i)?i.constructor:i;if(p0(e))return"float16";if(e===Uint8ClampedArray)return"uint8";const t=Object.values(tl).find(n=>e===n[4]);if(!t)throw new Error(e.name);return t[0]}function _0(i){return Wg(i)}function Mn(i){if(i==="float16")return g0();const e=tl[i];if(!e)throw new Error(i);const[,,,,t]=e;return t}function el(i){return Mn(i)}const tl={uint8:["uint8","u32",1,!1,Uint8Array],sint8:["sint8","i32",1,!1,Int8Array],unorm8:["uint8","f32",1,!0,Uint8Array],snorm8:["sint8","f32",1,!0,Int8Array],uint16:["uint16","u32",2,!1,Uint16Array],sint16:["sint16","i32",2,!1,Int16Array],unorm16:["uint16","u32",2,!0,Uint16Array],snorm16:["sint16","i32",2,!0,Int16Array],float16:["float16","f16",2,!1,Uint16Array],float32:["float32","f32",4,!1,Float32Array],uint32:["uint32","u32",4,!1,Uint32Array],sint32:["sint32","i32",4,!1,Int32Array]};class b0{getDataTypeInfo(e){return m0(e)}getNormalizedDataType(e){return y0(e)}alignTo(e,t){return ut(e,t)}getDataType(e){return _0(e)}getTypedArrayConstructor(e){return el(e)}}const mt=new b0;class v0{getVertexFormatInfo(e){if(e==="unorm10-10-10-2")return{type:"unorm8",components:4,byteLength:4,integer:!1,signed:!1,normalized:!0};let t=e==="unorm8x4-bgra"?"unorm8x4":e,n;t.endsWith("-webgl")&&(t=t.slice(0,-6),n=!0);const s=t.split("x");if(s.length>2)throw new Error(`Unsupported vertex format: ${e}`);const[r,o]=s,a=r,c=w0(e,o),l=x0(e,a);let u;try{u=n?P0(e,a,c):this.makeVertexFormat(l.signedType,c,l.normalized)}catch{throw new Error(`Unsupported vertex format: ${e}`)}if(u!==(n?e:t))throw new Error(`Unsupported vertex format: ${e}`);const f={type:a,components:c,byteLength:l.byteLength*c,integer:l.integer,signed:l.signed,normalized:l.normalized};return n&&(f.webglOnly=!0),f}makeVertexFormat(e,t,n){const s=n?mt.getNormalizedDataType(e):e;switch(s){case"unorm8":return t===1?"unorm8":t===3?"unorm8x3-webgl":`${s}x${t}`;case"snorm8":return t===1?"snorm8":t===3?"snorm8x3-webgl":`${s}x${t}`;case"uint8":case"sint8":if(t===3)throw new Error(`size: ${t}`);return t===1?s:`${s}x${t}`;case"uint16":return t===1?"uint16":t===3?"uint16x3-webgl":`${s}x${t}`;case"sint16":return t===1?"sint16":t===3?"sint16x3-webgl":`${s}x${t}`;case"unorm16":return t===1?"unorm16":t===3?"unorm16x3-webgl":`${s}x${t}`;case"snorm16":return t===1?"snorm16":t===3?"snorm16x3-webgl":`${s}x${t}`;case"float16":if(t===3)throw new Error(`size: ${t}`);return t===1?s:`${s}x${t}`;default:return t===1?s:`${s}x${t}`}}getVertexFormatFromAttribute(e,t,n){if(!t||t>4)throw new Error(`size ${t}`);const s=t,r=mt.getDataType(e);return this.makeVertexFormat(r,s,n)}getCompatibleVertexFormat(e){let t;switch(e.primitiveType){case"f32":t="float32";break;case"i32":t="sint32";break;case"u32":t="uint32";break;case"f16":return e.components<=2?"float16x2":"float16x4"}return e.components===1?t:`${t}x${e.components}`}}const Ee=new v0;function x0(i,e){try{return mt.getDataTypeInfo(e)}catch{throw new Error(`Unsupported vertex format: ${i}`)}}function w0(i,e){if(!e)return 1;const t=Number(e);if(t===2||t===3||t===4)return t;throw new Error(`Unsupported vertex format: ${i}`)}function P0(i,e,t){if(t!==3)throw new Error(`Unsupported vertex format: ${i}`);switch(e){case"uint8":case"sint8":case"unorm8":case"snorm8":case"uint16":case"sint16":case"unorm16":case"snorm16":return`${e}x3-webgl`;default:throw new Error(`Unsupported vertex format: ${i}`)}}const Pe="texture-compression-bc",le="texture-compression-astc",it="texture-compression-etc2",S0="texture-compression-etc1-webgl",ps="texture-compression-pvrtc-webgl",Bo="texture-compression-atc-webgl",ms="float32-renderable-webgl",Do="float16-renderable-webgl",E0="rgb9e5ufloat-renderable-webgl",Fo="snorm8-renderable-webgl",At="norm16-webgl",zo="norm16-renderable-webgl",No="snorm16-renderable-webgl",ys="float32-filterable",ef="float16-filterable-webgl",is=1,ns=2,il=4,nl=8,nn=16,Hr=5,Hg=10,ve=is|ns,_s=is|il,Pt=is|ns|il|nl,nt=is|ns|nn,C0=is|il|nn,Ja=Pt|nn,tf=(ns|nl|nn)<<Hr,L0=(ns|nl)<<Hr,Ce=nn<<Hr,Pi=Ja<<Hr,T0=Pt<<Hg,Uo=nn<<Hg;function sl(i){const e=Yg[i];if(!e)throw new Error(`Unsupported texture format ${i}`);return e}function A0(){return Yg}const M0={r8unorm:{webgpu:Pt|Ce},rg8unorm:{webgpu:Pt|Ce},"rgb8unorm-webgl":{},rgba8unorm:{webgpu:Ja},"rgba8unorm-srgb":{webgpu:Pt},r8snorm:{render:Fo,webgpu:_s|tf},rg8snorm:{render:Fo,webgpu:_s|tf},"rgb8snorm-webgl":{},rgba8snorm:{render:Fo,webgpu:C0|L0},r8uint:{webgpu:ve|Ce},rg8uint:{webgpu:ve|Ce},rgba8uint:{webgpu:nt},r8sint:{webgpu:ve|Ce},rg8sint:{webgpu:ve|Ce},rgba8sint:{webgpu:nt},bgra8unorm:{webgpu:Pt},"bgra8unorm-srgb":{webgpu:T0},r16unorm:{f:At,render:zo,webgpu:Pi},rg16unorm:{f:At,render:zo,webgpu:Pi},"rgb16unorm-webgl":{f:At,render:!1},rgba16unorm:{f:At,render:zo,webgpu:Pi},r16snorm:{f:At,render:No,webgpu:Pi},rg16snorm:{f:At,render:No,webgpu:Pi},"rgb16snorm-webgl":{f:At,render:!1},rgba16snorm:{f:At,render:No,webgpu:Pi},r16uint:{webgpu:ve|Ce},rg16uint:{webgpu:ve|Ce},rgba16uint:{webgpu:nt},r16sint:{webgpu:ve|Ce},rg16sint:{webgpu:ve|Ce},rgba16sint:{webgpu:nt},r16float:{render:Do,filter:"float16-filterable-webgl",webgpu:Pt|Ce},rg16float:{render:Do,filter:ef,webgpu:Pt|Ce},rgba16float:{render:Do,filter:ef,webgpu:Ja},r32uint:{webgpu:nt},rg32uint:{webgpu:ve|Uo},rgba32uint:{webgpu:nt},r32sint:{webgpu:nt},rg32sint:{webgpu:ve|Uo},rgba32sint:{webgpu:nt},r32float:{render:ms,filter:ys,webgpu:nt},rg32float:{render:!1,filter:ys,webgpu:ve|Uo},"rgb32float-webgl":{render:ms,filter:ys},rgba32float:{render:ms,filter:ys,webgpu:nt},"rgba4unorm-webgl":{channels:"rgba",bitsPerChannel:[4,4,4,4],packed:!0},"rgb565unorm-webgl":{channels:"rgb",bitsPerChannel:[5,6,5,0],packed:!0},"rgb5a1unorm-webgl":{channels:"rgba",bitsPerChannel:[5,5,5,1],packed:!0},rgb9e5ufloat:{channels:"rgb",packed:!0,render:E0,webgpu:_s},rg11b10ufloat:{channels:"rgb",bitsPerChannel:[11,11,10,0],packed:!0,p:1,render:ms,webgpu:_s|Ce},rgb10a2unorm:{channels:"rgba",bitsPerChannel:[10,10,10,2],packed:!0,p:1,webgpu:Pt|Ce},rgb10a2uint:{channels:"rgba",bitsPerChannel:[10,10,10,2],packed:!0,p:1,webgpu:ve|Ce},stencil8:{attachment:"stencil",bitsPerChannel:[8,0,0,0],dataType:"uint8",webgpu:ve},depth16unorm:{attachment:"depth",bitsPerChannel:[16,0,0,0],dataType:"uint16",webgpu:ve},depth24plus:{attachment:"depth",bitsPerChannel:[24,0,0,0],dataType:"uint32",webgpu:ve},depth32float:{attachment:"depth",bitsPerChannel:[32,0,0,0],dataType:"float32",webgpu:ve},"depth24plus-stencil8":{attachment:"depth-stencil",bitsPerChannel:[24,8,0,0],packed:!0,webgpu:ve},"depth32float-stencil8":{attachment:"depth-stencil",bitsPerChannel:[32,8,0,0],packed:!0,f:"depth32float-stencil8",webgpu:ve}},I0={"bc1-rgb-unorm-webgl":{f:Pe},"bc1-rgb-unorm-srgb-webgl":{f:Pe},"bc1-rgba-unorm":{f:Pe},"bc1-rgba-unorm-srgb":{f:Pe},"bc2-rgba-unorm":{f:Pe},"bc2-rgba-unorm-srgb":{f:Pe},"bc3-rgba-unorm":{f:Pe},"bc3-rgba-unorm-srgb":{f:Pe},"bc4-r-unorm":{f:Pe},"bc4-r-snorm":{f:Pe},"bc5-rg-unorm":{f:Pe},"bc5-rg-snorm":{f:Pe},"bc6h-rgb-ufloat":{f:Pe},"bc6h-rgb-float":{f:Pe},"bc7-rgba-unorm":{f:Pe},"bc7-rgba-unorm-srgb":{f:Pe},"etc2-rgb8unorm":{f:it},"etc2-rgb8unorm-srgb":{f:it},"etc2-rgb8a1unorm":{f:it},"etc2-rgb8a1unorm-srgb":{f:it},"etc2-rgba8unorm":{f:it},"etc2-rgba8unorm-srgb":{f:it},"eac-r11unorm":{f:it},"eac-r11snorm":{f:it},"eac-rg11unorm":{f:it},"eac-rg11snorm":{f:it},"astc-4x4-unorm":{f:le},"astc-4x4-unorm-srgb":{f:le},"astc-5x4-unorm":{f:le},"astc-5x4-unorm-srgb":{f:le},"astc-5x5-unorm":{f:le},"astc-5x5-unorm-srgb":{f:le},"astc-6x5-unorm":{f:le},"astc-6x5-unorm-srgb":{f:le},"astc-6x6-unorm":{f:le},"astc-6x6-unorm-srgb":{f:le},"astc-8x5-unorm":{f:le},"astc-8x5-unorm-srgb":{f:le},"astc-8x6-unorm":{f:le},"astc-8x6-unorm-srgb":{f:le},"astc-8x8-unorm":{f:le},"astc-8x8-unorm-srgb":{f:le},"astc-10x5-unorm":{f:le},"astc-10x5-unorm-srgb":{f:le},"astc-10x6-unorm":{f:le},"astc-10x6-unorm-srgb":{f:le},"astc-10x8-unorm":{f:le},"astc-10x8-unorm-srgb":{f:le},"astc-10x10-unorm":{f:le},"astc-10x10-unorm-srgb":{f:le},"astc-12x10-unorm":{f:le},"astc-12x10-unorm-srgb":{f:le},"astc-12x12-unorm":{f:le},"astc-12x12-unorm-srgb":{f:le},"pvrtc-rgb4unorm-webgl":{f:ps},"pvrtc-rgba4unorm-webgl":{f:ps},"pvrtc-rgb2unorm-webgl":{f:ps},"pvrtc-rgba2unorm-webgl":{f:ps},"etc1-rbg-unorm-webgl":{f:S0},"atc-rgb-unorm-webgl":{f:Bo},"atc-rgba-unorm-webgl":{f:Bo},"atc-rgbai-unorm-webgl":{f:Bo}},Yg={...M0,...I0},R0=/^(r|rg|rgb|rgba|bgra)([0-9]*)([a-z]*)(-srgb)?(-webgl)?$/,O0=["rgb","rgba","bgra"],k0=["depth","stencil"],B0=5,D0=["bc1","bc2","bc3","bc4","bc5","bc6","bc7","etc1","etc2","eac","atc","astc","pvrtc"];class F0{isColor(e){return O0.some(t=>e.startsWith(t))}isDepthStencil(e){return k0.some(t=>e.startsWith(t))}isCompressed(e){return D0.some(t=>e.startsWith(t))}getInfo(e){return qg(e)}getCapabilities(e){return N0(e)}getWebGPUCapabilities(e){const t=sl(e);return t.webgpu!==void 0?t.webgpu:this.isCompressed(e)&&!e.endsWith("-webgl")?B0:0}computeMemoryLayout(e){return z0(e)}}const Ze=new F0;function z0({format:i,width:e,height:t,depth:n,byteAlignment:s}){const r=Ze.getInfo(i),{bytesPerPixel:o,bytesPerBlock:a=o,blockWidth:c=1,blockHeight:l=1,compressed:u=!1}=r,f=u?Math.ceil(e/c):e,d=u?Math.ceil(t/l):t,h=f*a,g=Math.ceil(h/s)*s,p=d,m=g*p*n;return{bytesPerPixel:o,bytesPerRow:g,rowsPerImage:p,depthOrArrayLayers:n,bytesPerImage:g*p,byteLength:m}}function N0(i){const e=sl(i),t={format:i,create:e.f??!0,render:e.render??!0,filter:e.filter??!0,blend:e.blend??!0,store:e.store??!0},n=qg(i),s=i.startsWith("depth")||i.startsWith("stencil"),r=n?.signed,o=n?.integer,a=n?.webgl,c=!!n?.compressed;return t.render&&=!s&&!c,t.filter&&=!s&&!r&&!o&&!a,t}function qg(i){let e=U0(i);if(Ze.isCompressed(i)){e.channels="rgb",e.components=3,e.bytesPerPixel=1,e.srgb=!1,e.compressed=!0,e.bytesPerBlock=G0(i);const n=$0(i);n&&(e.blockWidth=n.blockWidth,e.blockHeight=n.blockHeight)}const t=e.packed?null:R0.exec(i);if(t){const[,n,s,r,o,a]=t,c=`${r}${s}`,l=mt.getDataTypeInfo(c),u=l.byteLength*8,f=n?.length??1,d=[u,f>=2?u:0,f>=3?u:0,f>=4?u:0];e={format:i,attachment:e.attachment,dataType:l.signedType,components:f,channels:n,integer:l.integer,signed:l.signed,normalized:l.normalized,bitsPerChannel:d,bytesPerPixel:l.byteLength*f,packed:e.packed,srgb:e.srgb},a==="-webgl"&&(e.webgl=!0),o==="-srgb"&&(e.srgb=!0)}return i.endsWith("-webgl")&&(e.webgl=!0),i.endsWith("-srgb")&&(e.srgb=!0),e}function U0(i){const e={...sl(i)},t=e.bytesPerPixel||1,n=e.bitsPerChannel||[8,8,8,8];return delete e.bitsPerChannel,delete e.bytesPerPixel,delete e.f,delete e.render,delete e.filter,delete e.blend,delete e.store,delete e.webgpu,{...e,format:i,attachment:e.attachment||"color",channels:e.channels||"r",components:e.components||e.channels?.length||1,bytesPerPixel:t,bitsPerChannel:n,dataType:e.dataType||"uint8",srgb:e.srgb??!1,packed:e.packed??!1,webgl:e.webgl??!1,integer:e.integer??!1,signed:e.signed??!1,normalized:e.normalized??!1,compressed:e.compressed??!1}}function $0(i){const t=/.*-(\d+)x(\d+)-.*/.exec(i);if(t){const[,n,s]=t;return{blockWidth:Number(n),blockHeight:Number(s)}}return i.startsWith("bc")||i.startsWith("etc1")||i.startsWith("etc2")||i.startsWith("eac")||i.startsWith("atc")?{blockWidth:4,blockHeight:4}:i.startsWith("pvrtc-rgb4")||i.startsWith("pvrtc-rgba4")?{blockWidth:4,blockHeight:4}:i.startsWith("pvrtc-rgb2")||i.startsWith("pvrtc-rgba2")?{blockWidth:8,blockHeight:4}:null}function G0(i){return i.startsWith("bc1")||i.startsWith("bc4")||i.startsWith("etc1")||i.startsWith("etc2-rgb8")||i.startsWith("etc2-rgb8a1")||i.startsWith("eac-r11")||i==="atc-rgb-unorm-webgl"?8:i.startsWith("bc2")||i.startsWith("bc3")||i.startsWith("bc5")||i.startsWith("bc6h")||i.startsWith("bc7")||i.startsWith("etc2-rgba8")||i.startsWith("eac-rg11")||i.startsWith("astc")||i==="atc-rgba-unorm-webgl"||i==="atc-rgbai-unorm-webgl"?16:i.startsWith("pvrtc")?8:16}function V0(i){return typeof ImageData<"u"&&i instanceof ImageData||typeof ImageBitmap<"u"&&i instanceof ImageBitmap||typeof HTMLImageElement<"u"&&i instanceof HTMLImageElement||typeof HTMLVideoElement<"u"&&i instanceof HTMLVideoElement||typeof VideoFrame<"u"&&i instanceof VideoFrame||typeof HTMLCanvasElement<"u"&&i instanceof HTMLCanvasElement||typeof OffscreenCanvas<"u"&&i instanceof OffscreenCanvas}function j0(i){if(typeof ImageData<"u"&&i instanceof ImageData||typeof ImageBitmap<"u"&&i instanceof ImageBitmap||typeof HTMLCanvasElement<"u"&&i instanceof HTMLCanvasElement||typeof OffscreenCanvas<"u"&&i instanceof OffscreenCanvas)return{width:i.width,height:i.height};if(typeof HTMLImageElement<"u"&&i instanceof HTMLImageElement)return{width:i.naturalWidth,height:i.naturalHeight};if(typeof HTMLVideoElement<"u"&&i instanceof HTMLVideoElement)return{width:i.videoWidth,height:i.videoHeight};if(typeof VideoFrame<"u"&&i instanceof VideoFrame)return{width:i.displayWidth,height:i.displayHeight};throw new Error("Unknown image type")}class W0{}function H0(i,e){const t=ec(i),n=e.map(ec).filter(s=>s!==void 0);return[t,...n].filter(s=>s!==void 0)}function ec(i){if(i!==void 0){if(i===null||typeof i=="string"||typeof i=="number"||typeof i=="boolean")return i;if(i instanceof Error)return i.message;if(Array.isArray(i))return i.map(ec);if(typeof i=="object"){if(Y0(i)){const e=String(i);if(e!=="[object Object]")return e}return q0(i)?Z0(i):i.constructor?.name||"Object"}return String(i)}}function Y0(i){return"toString"in i&&typeof i.toString=="function"&&i.toString!==Object.prototype.toString}function q0(i){return"message"in i&&"type"in i}function Z0(i){const e=typeof i.type=="string"?i.type:"message",t=typeof i.message=="string"?i.message:"",n=typeof i.lineNum=="number"?i.lineNum:null,s=typeof i.linePos=="number"?i.linePos:null,r=n!==null&&s!==null?` @ ${n}:${s}`:n!==null?` @ ${n}`:"";return`${e}${r}: ${t}`.trim()}class X0{features;disabledFeatures;constructor(e=[],t){this.features=new Set(e),this.disabledFeatures=t||{}}*[Symbol.iterator](){yield*this.features}has(e){return!this.disabledFeatures?.[e]&&this.features.has(e)}}function K0(){if(typeof HTMLCanvasElement>"u")return!1;const i=HTMLCanvasElement.prototype;return"layoutSubtree"in i&&typeof i.requestPaint=="function"}class Wi{static defaultProps={...Vg};get[Symbol.toStringTag](){return"Device"}toString(){return`Device(${this.id})`}toJSON(){return this.toString()}id;props;userData={};statsManager=jg;_factories={};timestamp=0;_reused=!1;_moduleData={};wgslLanguageFeatures=new Set;_textureCaps={};_debugGPUTimeQuery=null;constructor(e){this.props={...Wi.defaultProps,...e},this.id=this.props.id||ts(this[Symbol.toStringTag].toLowerCase())}getVertexFormatInfo(e){return Ee.getVertexFormatInfo(e)}isVertexFormatSupported(e){return!0}getTextureFormatInfo(e){return Ze.getInfo(e)}getTextureFormatCapabilities(e){let t=this._textureCaps[e];if(!t){const n=this._getDeviceTextureFormatCapabilities(e);t=this._getDeviceSpecificTextureFormatCapabilities(n),this._textureCaps[e]=t}return t}getMipLevelCount(e,t,n=1){const s=Math.max(e,t,n);return 1+Math.floor(Math.log2(s))}isExternalImage(e){return V0(e)}getExternalImageSize(e){return j0(e)}isTextureFormatSupported(e){return this.getTextureFormatCapabilities(e).create}isTextureFormatFilterable(e){return this.getTextureFormatCapabilities(e).filter}isTextureFormatRenderable(e){return this.getTextureFormatCapabilities(e).render}isTextureFormatCompressed(e){return Ze.isCompressed(e)}getSupportedCompressedTextureFormats(){const e=[];for(const t of Object.keys(A0()))this.isTextureFormatCompressed(t)&&this.isTextureFormatSupported(t)&&e.push(t);return e}pushDebugGroup(e){this.commandEncoder.pushDebugGroup(e)}popDebugGroup(){this.commandEncoder?.popDebugGroup()}insertDebugMarker(e){this.commandEncoder?.insertDebugMarker(e)}loseDevice(){return!1}incrementTimestamp(){return this.timestamp++}reportError(e,t,...n){if(!this.props.onError(e,t)){const r=H0(t,n);return A.error(this.type==="webgl"?"%cWebGL":"%cWebGPU","color: white; background: red; padding: 2px 6px; border-radius: 3px;",e.message,...r)}return()=>{}}debug(){if(this.props.debug)debugger;else A.once(0,`'Type luma.log.set({debug: true}) in console to enable debug breakpoints',
or create a device with the 'debug: true' prop.`)()}getDefaultCanvasContext(){if(!this.canvasContext)throw new Error("Device has no default CanvasContext. See props.createCanvasContext");return this.canvasContext}createFence(){throw new Error("createFence() not implemented")}beginRenderPass(e){return this.commandEncoder.beginRenderPass(e)}beginComputePass(e){return this.commandEncoder.beginComputePass(e)}writeBufferViaCommandEncoder(e,t,n,s=0){throw new Error("writeBufferViaCommandEncoder() not implemented")}generateMipmapsWebGPU(e){throw new Error("not implemented")}_createSharedRenderPipelineWebGL(e){throw new Error("_createSharedRenderPipelineWebGL() not implemented")}_createBindGroupLayoutWebGPU(e,t){throw new Error("_createBindGroupLayoutWebGPU() not implemented")}_createBindGroupWebGPU(e,t,n,s,r){throw new Error("_createBindGroupWebGPU() not implemented")}_supportsDebugGPUTime(){return this.features.has("timestamp-query")&&!!(this.props.debug||this.props.debugGPUTime)}_enableDebugGPUTime(e=256){if(!this._supportsDebugGPUTime())return null;if(this._debugGPUTimeQuery)return this._debugGPUTimeQuery;try{this._debugGPUTimeQuery=this.createQuerySet({type:"timestamp",count:e}),this.commandEncoder=this.createCommandEncoder({id:this.commandEncoder.props.id,timeProfilingQuerySet:this._debugGPUTimeQuery})}catch{this._debugGPUTimeQuery=null}return this._debugGPUTimeQuery}_disableDebugGPUTime(){this._debugGPUTimeQuery&&(this.commandEncoder.getTimeProfilingQuerySet()===this._debugGPUTimeQuery&&(this.commandEncoder=this.createCommandEncoder({id:this.commandEncoder.props.id})),this._debugGPUTimeQuery.destroy(),this._debugGPUTimeQuery=null)}_isDebugGPUTimeEnabled(){return this._debugGPUTimeQuery!==null}getCanvasContext(){return this.getDefaultCanvasContext()}readPixelsToArrayWebGL(e,t){throw new Error("not implemented")}readPixelsToBufferWebGL(e,t){throw new Error("not implemented")}setParametersWebGL(e){throw new Error("not implemented")}getParametersWebGL(e){throw new Error("not implemented")}withParametersWebGL(e,t){throw new Error("not implemented")}clearWebGL(e){throw new Error("not implemented")}resetWebGL(){throw new Error("not implemented")}getModuleData(e){return this._moduleData[e]||={},this._moduleData[e]}static _getCanvasContextProps(e){return e.createCanvasContext===!0?{}:e.createCanvasContext}_getDeviceTextureFormatCapabilities(e){const t=Ze.getCapabilities(e),n=r=>(typeof r=="string"?this.features.has(r):r)??!0,s=n(t.create);return{format:e,create:s,render:s&&n(t.render),filter:s&&n(t.filter),blend:s&&n(t.blend),store:s&&n(t.store)}}_normalizeBufferProps(e){(e instanceof ArrayBuffer||ArrayBuffer.isView(e))&&(e={data:e});const t={...e};if((e.usage||0)&q.INDEX&&(e.indexType||(e.data instanceof Uint32Array?t.indexType="uint32":e.data instanceof Uint16Array?t.indexType="uint16":e.data instanceof Uint8Array&&(t.data=new Uint16Array(e.data),t.indexType="uint16")),!t.indexType))throw new Error("indices buffer content must be of type uint16 or uint32");return t}}class Q0{props;_resizeObserver;_intersectionObserver;_observeDevicePixelRatioTimeout=null;_observeDevicePixelRatioMediaQuery=null;_handleDevicePixelRatioChange=()=>this._refreshDevicePixelRatio();_trackPositionInterval=null;_started=!1;get started(){return this._started}constructor(e){this.props=e}start(){if(this._started||!this.props.canvas)return;this._started=!0,this._intersectionObserver||=new IntersectionObserver(t=>this.props.onIntersection(t)),this._resizeObserver||=new ResizeObserver(t=>this.props.onResize(t)),this._intersectionObserver.observe(this.props.canvas);const e=this.props.resizeObserverBox;try{this._resizeObserver.observe(this.props.canvas,{box:e})}catch{this._resizeObserver.observe(this.props.canvas,{box:"content-box"})}this._observeDevicePixelRatioTimeout=setTimeout(()=>this._refreshDevicePixelRatio(),0),this.props.trackPosition&&this._trackPosition()}stop(){this._started&&(this._started=!1,this._observeDevicePixelRatioTimeout&&(clearTimeout(this._observeDevicePixelRatioTimeout),this._observeDevicePixelRatioTimeout=null),this._observeDevicePixelRatioMediaQuery&&(this._observeDevicePixelRatioMediaQuery.removeEventListener("change",this._handleDevicePixelRatioChange),this._observeDevicePixelRatioMediaQuery=null),this._trackPositionInterval&&(clearInterval(this._trackPositionInterval),this._trackPositionInterval=null),this._resizeObserver?.disconnect(),this._intersectionObserver?.disconnect())}_refreshDevicePixelRatio(){this._started&&(this.props.onDevicePixelRatioChange(),this._observeDevicePixelRatioMediaQuery?.removeEventListener("change",this._handleDevicePixelRatioChange),this._observeDevicePixelRatioMediaQuery=matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`),this._observeDevicePixelRatioMediaQuery.addEventListener("change",this._handleDevicePixelRatioChange,{once:!0}))}_trackPosition(e=100){this._trackPositionInterval||(this._trackPositionInterval=setInterval(()=>{this._started?this.props.onPositionChange():this._trackPositionInterval&&(clearInterval(this._trackPositionInterval),this._trackPositionInterval=null)},e))}}function J0(){let i,e;return{promise:new Promise((n,s)=>{i=n,e=s}),resolve:i,reject:e}}function Gn(i,e){if(!i){const t=new Error(e??"luma.gl assertion failed.");throw Error.captureStackTrace?.(t,Gn),t}}function vr(i,e){return Gn(i,e),i}class Nt{static isHTMLCanvas(e){return typeof HTMLCanvasElement<"u"&&e instanceof HTMLCanvasElement}static isOffscreenCanvas(e){return typeof OffscreenCanvas<"u"&&e instanceof OffscreenCanvas}static defaultProps={id:void 0,canvas:null,width:800,height:600,useDevicePixels:!0,pixelSizeSource:"exact",autoResize:!0,container:null,visible:!0,alphaMode:"opaque",colorSpace:"srgb",colorFormat:void 0,toneMapping:"standard",trackPosition:!1};id;props;canvas;htmlCanvas;offscreenCanvas;type;initialized;isInitialized=!1;isVisible=!0;cssWidth;cssHeight;devicePixelRatio;devicePixelWidth;devicePixelHeight;drawingBufferWidth;drawingBufferHeight;_initializedResolvers=J0();_canvasObserver;_position=[0,0];destroyed=!1;_needsDrawingBufferResize=!0;toString(){return`${this[Symbol.toStringTag]}(${this.id})`}constructor(e){this.props={...Nt.defaultProps,...e},e=this.props,this.initialized=this._initializedResolvers.promise,Ji()?e.canvas?typeof e.canvas=="string"?this.canvas=tx(e.canvas):this.canvas=e.canvas:this.canvas=ix(e):this.canvas={width:e.width||1,height:e.height||1},Nt.isHTMLCanvas(this.canvas)?(this.id=e.id||this.canvas.id,this.type="html-canvas",this.htmlCanvas=this.canvas):Nt.isOffscreenCanvas(this.canvas)?(this.id=e.id||"offscreen-canvas",this.type="offscreen-canvas",this.offscreenCanvas=this.canvas):(this.id=e.id||"node-canvas-context",this.type="node"),this.cssWidth=this.htmlCanvas?.clientWidth||this.canvas.width,this.cssHeight=this.htmlCanvas?.clientHeight||this.canvas.height,this.devicePixelWidth=this.canvas.width,this.devicePixelHeight=this.canvas.height,this.drawingBufferWidth=this.canvas.width,this.drawingBufferHeight=this.canvas.height,this.devicePixelRatio=globalThis.devicePixelRatio||1,this._position=[0,0],this._canvasObserver=new Q0({canvas:this.htmlCanvas,trackPosition:this.props.trackPosition,resizeObserverBox:this.props.pixelSizeSource==="css-dpr"?"content-box":"device-pixel-content-box",onResize:t=>this._handleResize(t),onIntersection:t=>this._handleIntersection(t),onDevicePixelRatioChange:()=>this._observeDevicePixelRatio(),onPositionChange:()=>this.updatePosition()})}destroy(){this.destroyed||(this.destroyed=!0,this._stopObservers(),this.device=null)}setProps(e){return"useDevicePixels"in e&&(this.props.useDevicePixels=e.useDevicePixels||!1,this._updateDrawingBufferSize()),this}getCurrentFramebuffer(e){return this._resizeDrawingBufferIfNeeded(),this._getCurrentFramebuffer(e)}getCSSSize(){return[this.cssWidth,this.cssHeight]}getPosition(){return this._position}getDevicePixelSize(){return[this.devicePixelWidth,this.devicePixelHeight]}getDrawingBufferSize(){return[this.drawingBufferWidth,this.drawingBufferHeight]}getMaxDrawingBufferSize(){const e=this.device.limits.maxTextureDimension2D;return[e,e]}setDrawingBufferSize(e,t){e=Math.floor(e),t=Math.floor(t),!(this.drawingBufferWidth===e&&this.drawingBufferHeight===t)&&(this.drawingBufferWidth=e,this.drawingBufferHeight=t,this._needsDrawingBufferResize=!0)}getDevicePixelRatio(){return typeof window<"u"&&window.devicePixelRatio||1}cssToDevicePixels(e,t=!0){const n=this.cssToDeviceRatio(),[s,r]=this.getDrawingBufferSize();return nx(e,n,s,r,t)}getPixelSize(){return this.getDevicePixelSize()}getAspect(){const[e,t]=this.getDrawingBufferSize();return e>0&&t>0?e/t:1}cssToDeviceRatio(){try{const[e]=this.getDrawingBufferSize(),[t]=this.getCSSSize();return t?e/t:1}catch{return 1}}resize(e){this.setDrawingBufferSize(e.width,e.height)}_setAutoCreatedCanvasId(e){this.htmlCanvas?.id==="lumagl-auto-created-canvas"&&(this.htmlCanvas.id=e)}_startObservers(){this.destroyed||this._canvasObserver.start()}_stopObservers(){this._canvasObserver.stop()}_handleIntersection(e){if(this.destroyed)return;const t=e.find(s=>s.target===this.canvas);if(!t)return;const n=t.isIntersecting;this.isVisible!==n&&(this.isVisible=n,this.device.props.onVisibilityChange(this))}_handleResize(e){if(this.destroyed)return;const t=e.find(r=>r.target===this.canvas);if(!t)return;const n=vr(t.contentBoxSize?.[0]);this.cssWidth=n.inlineSize,this.cssHeight=n.blockSize;const s=this.getDevicePixelSize();this._setDevicePixelSize(this._getDevicePixelSizeFromResizeEntry(t)),this._updateDrawingBufferSize(),this.device.props.onResize(this,{oldPixelSize:s})}_updateDrawingBufferSize(){if(this.props.autoResize)if(typeof this.props.useDevicePixels=="number"){const e=this.props.useDevicePixels;this.setDrawingBufferSize(this.cssWidth*e,this.cssHeight*e)}else this.props.useDevicePixels?this.setDrawingBufferSize(this.devicePixelWidth,this.devicePixelHeight):this.setDrawingBufferSize(this.cssWidth,this.cssHeight);this._initializedResolvers.resolve(),this.isInitialized=!0,this.updatePosition()}_getDevicePixelSizeFromResizeEntry(e){const t=vr(e.contentBoxSize?.[0]);return this.props.pixelSizeSource==="css-dpr"?this._getDevicePixelSizeFromCSSSize(t.inlineSize,t.blockSize):{devicePixelWidth:e.devicePixelContentBoxSize?.[0]?.inlineSize||t.inlineSize*devicePixelRatio,devicePixelHeight:e.devicePixelContentBoxSize?.[0]?.blockSize||t.blockSize*devicePixelRatio}}_getDevicePixelSizeFromCSSSize(e,t){const n=this.getDevicePixelRatio();return{devicePixelWidth:Math.floor(e*n),devicePixelHeight:Math.floor(t*n)}}_setDevicePixelSize({devicePixelWidth:e,devicePixelHeight:t}){const[n,s]=this.getMaxDrawingBufferSize();this.devicePixelWidth=Math.max(1,Math.min(e,n)),this.devicePixelHeight=Math.max(1,Math.min(t,s))}_resizeDrawingBufferIfNeeded(){this._needsDrawingBufferResize&&(this._needsDrawingBufferResize=!1,(this.drawingBufferWidth!==this.canvas.width||this.drawingBufferHeight!==this.canvas.height)&&(this.canvas.width=this.drawingBufferWidth,this.canvas.height=this.drawingBufferHeight,this._configureDevice()))}_observeDevicePixelRatio(){if(this.destroyed||!this._canvasObserver.started)return;const e=this.devicePixelRatio;if(this.devicePixelRatio=window.devicePixelRatio,this.props.pixelSizeSource==="css-dpr"){const t=this.getDevicePixelSize();this._setDevicePixelSize(this._getDevicePixelSizeFromCSSSize(this.cssWidth,this.cssHeight)),this._updateDrawingBufferSize(),this.device.props.onResize(this,{oldPixelSize:t})}this.updatePosition(),this.device.props.onDevicePixelRatioChange?.(this,{oldRatio:e})}updatePosition(){if(this.destroyed)return;const e=this.htmlCanvas?.getBoundingClientRect();if(e){const t=[e.left,e.top];if(this._position??=t,t[0]!==this._position[0]||t[1]!==this._position[1]){const s=this._position;this._position=t,this.device.props.onPositionChange?.(this,{oldPosition:s})}}}}function ex(i){if(typeof i=="string"){const e=document.getElementById(i);if(!e)throw new Error(`${i} is not an HTML element`);return e}return i||document.body}function tx(i){const e=document.getElementById(i);if(!Nt.isHTMLCanvas(e))throw new Error("Object is not a canvas element");return e}function ix(i){const{width:e,height:t}=i,n=document.createElement("canvas");n.id=ts("lumagl-auto-created-canvas"),n.width=e||1,n.height=t||1,n.style.width=Number.isFinite(e)?`${e}px`:"100%",n.style.height=Number.isFinite(t)?`${t}px`:"100%",i?.visible||(n.style.visibility="hidden");const s=ex(i?.container||null);return s.insertBefore(n,s.firstChild),n}function nx(i,e,t,n,s){const r=i,o=nf(r[0],e,t);let a=sf(r[1],e,n,s),c=nf(r[0]+1,e,t);const l=c===t-1?c:c-1;c=sf(r[1]+1,e,n,s);let u;return s?(c=c===0?c:c+1,u=a,a=c):u=c===n-1?c:c-1,{x:o,y:a,width:Math.max(l-o+1,1),height:Math.max(u-a+1,1)}}function nf(i,e,t){return Math.min(Math.round(i*e),t-1)}function sf(i,e,t,n){return n?Math.max(0,t-1-Math.round(i*e)):Math.min(Math.round(i*e),t-1)}class sx extends Nt{static defaultProps=Nt.defaultProps}class rx extends Nt{}class Vn extends Q{static defaultProps={...Q.defaultProps,type:"color-sampler",addressModeU:"clamp-to-edge",addressModeV:"clamp-to-edge",addressModeW:"clamp-to-edge",magFilter:"nearest",minFilter:"nearest",mipmapFilter:"none",lodMinClamp:0,lodMaxClamp:32,compare:"less-equal",maxAnisotropy:1};get[Symbol.toStringTag](){return"Sampler"}constructor(e,t){t=Vn.normalizeProps(e,t),super(e,t,Vn.defaultProps)}static normalizeProps(e,t){return t}}const ox={"1d":"1d","2d":"2d","2d-array":"2d",cube:"2d","cube-array":"2d","3d":"3d"};class re extends Q{static SAMPLE=4;static STORAGE=8;static RENDER=16;static COPY_SRC=1;static COPY_DST=2;static TEXTURE=4;static RENDER_ATTACHMENT=16;dimension;baseDimension;format;width;height;depth;mipLevels;samples;byteAlignment;ready=Promise.resolve(this);isReady=!0;updateTimestamp;get[Symbol.toStringTag](){return"Texture"}toString(){return`Texture(${this.id},${this.format},${this.width}x${this.height})`}constructor(e,t,n){if(t=re.normalizeProps(e,t),super(e,t,re.defaultProps),this.dimension=this.props.dimension,this.baseDimension=ox[this.dimension],this.format=this.props.format,this.width=this.props.width,this.height=this.props.height,this.depth=this.props.depth,this.mipLevels=this.props.mipLevels,this.samples=this.props.samples||1,this.dimension==="cube"&&(this.depth=6),this.props.width===void 0||this.props.height===void 0)if(e.isExternalImage(t.data)){const s=e.getExternalImageSize(t.data);this.width=s?.width||1,this.height=s?.height||1}else this.width=1,this.height=1,(this.props.width===void 0||this.props.height===void 0)&&A.warn(`${this} created with undefined width or height. This is deprecated. Use DynamicTexture instead.`)();this.byteAlignment=n?.byteAlignment||1,this.updateTimestamp=e.incrementTimestamp()}clone(e){return this.device.createTexture({...this.props,...e})}setSampler(e){this.sampler=e instanceof Vn?e:this.device.createSampler(e)}copyImageData(e){const{data:t,depth:n,...s}=e;this.writeData(t,{...s,depthOrArrayLayers:s.depthOrArrayLayers??n})}computeMemoryLayout(e={}){const t=this._normalizeTextureReadOptions(e),{width:n=this.width,height:s=this.height,depthOrArrayLayers:r=this.depth}=t,{format:o,byteAlignment:a}=this;return Ze.computeMemoryLayout({format:o,width:n,height:s,depth:r,byteAlignment:a})}readBuffer(e,t){throw new Error("readBuffer not implemented")}readDataAsync(e){throw new Error("readBuffer not implemented")}writeBuffer(e,t){throw new Error("readBuffer not implemented")}writeData(e,t){throw new Error("readBuffer not implemented")}readDataSyncWebGL(e){throw new Error("readDataSyncWebGL not available")}generateMipmapsWebGL(){throw new Error("generateMipmapsWebGL not available")}static normalizeProps(e,t){const n={...t},{width:s,height:r}=n;return typeof s=="number"&&(n.width=Math.max(1,Math.ceil(s))),typeof r=="number"&&(n.height=Math.max(1,Math.ceil(r))),n}_initializeData(e){this.device.isExternalImage(e)?this.copyExternalImage({image:e,width:this.width,height:this.height,depth:this.depth,mipLevel:0,x:0,y:0,z:0,aspect:"all",colorSpace:"srgb",premultipliedAlpha:!1,flipY:!1}):e&&this.copyImageData({data:e,mipLevel:0,x:0,y:0,z:0,aspect:"all"})}_normalizeCopyImageDataOptions(e){const{data:t,depth:n,...s}=e,r=this._normalizeTextureWriteOptions({...s,depthOrArrayLayers:s.depthOrArrayLayers??n});return{data:t,depth:r.depthOrArrayLayers,...r}}_normalizeCopyExternalImageOptions(e){const t=re._omitUndefined(e),n=t.mipLevel??0,s=this._getMipLevelSize(n),r=this.device.getExternalImageSize(e.image),o={...re.defaultCopyExternalImageOptions,...s,...r,...t};return o.width=Math.min(o.width,s.width-o.x),o.height=Math.min(o.height,s.height-o.y),o.depth=Math.min(o.depth,s.depthOrArrayLayers-o.z),o}_normalizeCopyElementImageOptions(e){const t=re._omitUndefined(e),n=t.mipLevel??0,s=this._getMipLevelSize(n),r={...re.defaultCopyElementImageOptions,...s,...t};return r.width=Math.min(r.width,s.width-r.x),r.height=Math.min(r.height,s.height-r.y),r.depth=Math.min(r.depth,s.depthOrArrayLayers-r.z),r}_normalizeTextureReadOptions(e){const t=re._omitUndefined(e),n=t.mipLevel??0,s=this._getMipLevelSize(n),r={...re.defaultTextureReadOptions,...s,...t};return r.width=Math.min(r.width,s.width-r.x),r.height=Math.min(r.height,s.height-r.y),r.depthOrArrayLayers=Math.min(r.depthOrArrayLayers,s.depthOrArrayLayers-r.z),r}_getSupportedColorReadOptions(e){const t=this._normalizeTextureReadOptions(e),n=Ze.getInfo(this.format);switch(this._validateColorReadAspect(t),this._validateColorReadFormat(n),this.dimension){case"2d":case"cube":case"cube-array":case"2d-array":case"3d":return t;default:throw new Error(`${this} color readback does not support ${this.dimension} textures`)}}_validateColorReadAspect(e){if(e.aspect!=="all")throw new Error(`${this} color readback only supports aspect 'all'`)}_validateColorReadFormat(e){if(e.compressed)throw new Error(`${this} color readback does not support compressed formats (${this.format})`);switch(e.attachment){case"color":return;case"depth":throw new Error(`${this} color readback does not support depth formats (${this.format})`);case"stencil":throw new Error(`${this} color readback does not support stencil formats (${this.format})`);case"depth-stencil":throw new Error(`${this} color readback does not support depth-stencil formats (${this.format})`);default:throw new Error(`${this} color readback does not support format ${this.format}`)}}_normalizeTextureWriteOptions(e){const t=re._omitUndefined(e),n=t.mipLevel??0,s=this._getMipLevelSize(n),r={...re.defaultTextureWriteOptions,...s,...t};r.width=Math.min(r.width,s.width-r.x),r.height=Math.min(r.height,s.height-r.y),r.depthOrArrayLayers=Math.min(r.depthOrArrayLayers,s.depthOrArrayLayers-r.z);const o=Ze.computeMemoryLayout({format:this.format,width:r.width,height:r.height,depth:r.depthOrArrayLayers,byteAlignment:this.byteAlignment}),a=o.bytesPerPixel*r.width;if(r.bytesPerRow=t.bytesPerRow??o.bytesPerRow,r.rowsPerImage=t.rowsPerImage??r.height,r.bytesPerRow<a)throw new Error(`bytesPerRow (${r.bytesPerRow}) must be at least ${a} for ${this.format}`);if(r.rowsPerImage<r.height)throw new Error(`rowsPerImage (${r.rowsPerImage}) must be at least ${r.height} for ${this.format}`);const c=this.device.getTextureFormatInfo(this.format).bytesPerPixel;if(c&&r.bytesPerRow%c!==0)throw new Error(`bytesPerRow (${r.bytesPerRow}) must be a multiple of bytesPerPixel (${c}) for ${this.format}`);return r}_getMipLevelSize(e){const t=Math.max(1,this.width>>e),n=this.baseDimension==="1d"?1:Math.max(1,this.height>>e),s=this.dimension==="3d"?Math.max(1,this.depth>>e):this.depth;return{width:t,height:n,depthOrArrayLayers:s}}getAllocatedByteLength(){let e=0;for(let t=0;t<this.mipLevels;t++){const{width:n,height:s,depthOrArrayLayers:r}=this._getMipLevelSize(t);e+=Ze.computeMemoryLayout({format:this.format,width:n,height:s,depth:r,byteAlignment:1}).byteLength}return e*this.samples}static _omitUndefined(e){return Object.fromEntries(Object.entries(e).filter(([,t])=>t!==void 0))}static defaultProps={...Q.defaultProps,data:null,dimension:"2d",format:"rgba8unorm",usage:re.SAMPLE|re.RENDER|re.COPY_DST,width:void 0,height:void 0,depth:1,mipLevels:1,samples:void 0,sampler:{},view:void 0};static defaultCopyDataOptions={data:void 0,byteOffset:0,bytesPerRow:void 0,rowsPerImage:void 0,width:void 0,height:void 0,depthOrArrayLayers:void 0,depth:1,mipLevel:0,x:0,y:0,z:0,aspect:"all"};static defaultCopyExternalImageOptions={image:void 0,sourceX:0,sourceY:0,width:void 0,height:void 0,depth:1,mipLevel:0,x:0,y:0,z:0,aspect:"all",colorSpace:"srgb",premultipliedAlpha:!1,flipY:!1};static defaultCopyElementImageOptions={element:void 0,width:void 0,height:void 0,sourceX:0,sourceY:0,sourceWidth:void 0,sourceHeight:void 0,depth:1,mipLevel:0,x:0,y:0,z:0,aspect:"all",colorSpace:"srgb",premultipliedAlpha:!1,flipY:!1};static defaultTextureReadOptions={x:0,y:0,z:0,width:void 0,height:void 0,depthOrArrayLayers:1,mipLevel:0,aspect:"all"};static defaultTextureWriteOptions={byteOffset:0,bytesPerRow:void 0,rowsPerImage:void 0,x:0,y:0,z:0,width:void 0,height:void 0,depthOrArrayLayers:1,mipLevel:0,aspect:"all"}}class Yr extends Q{get[Symbol.toStringTag](){return"TextureView"}constructor(e,t){super(e,t,Yr.defaultProps)}static defaultProps={...Q.defaultProps,format:void 0,dimension:void 0,aspect:"all",baseMipLevel:0,mipLevelCount:void 0,baseArrayLayer:0,arrayLayerCount:void 0}}class rl extends Q{width;height;updateTimestamp;get[Symbol.toStringTag](){return"ExternalTexture"}constructor(e,t){super(e,t,rl.defaultProps);const n=this.props.source?e.getExternalImageSize(this.props.source):null;this.width=this.props.width||n?.width||0,this.height=this.props.height||n?.height||0,this.updateTimestamp=e.incrementTimestamp()}static defaultProps={...Q.defaultProps,source:void 0,width:0,height:0,colorSpace:"srgb",sampler:{}}}function ax(i,e,t){let n="";const s=e.split(/\r?\n/),r=i.slice().sort((o,a)=>o.lineNum-a.lineNum);switch(t?.showSourceCode||"no"){case"all":let o=0;for(let a=1;a<=s.length;a++){const c=s[a-1],l=r[o];for(c&&l&&(n+=Zg(c,a,t));r.length>o&&l.lineNum===a;){const u=r[o++];u&&(n+=$o(u,s,u.lineNum,{...t,inlineSource:!1}))}}for(;r.length>o;){const a=r[o++];a&&(n+=$o(a,[],0,{...t,inlineSource:!1}))}return n;case"issues":case"no":for(const a of i)n+=$o(a,s,a.lineNum,{inlineSource:t?.showSourceCode!=="no"});return n}}function $o(i,e,t,n){if(n?.inlineSource){const r=cx(e,t),o=i.linePos>0?`${" ".repeat(i.linePos+5)}^^^
`:"";return`
${r}${o}${i.type.toUpperCase()}: ${i.message}

`}const s=i.type==="error"?"red":"orange";return n?.html?`<div class='luma-compiler-log-${i.type}' style="color:${s};"><b> ${i.type.toUpperCase()}: ${i.message}</b></div>`:`${i.type.toUpperCase()}: ${i.message}`}function cx(i,e,t){let n="";for(let s=e-2;s<=e;s++){const r=i[s-1];r!==void 0&&(n+=Zg(r,e,t))}return n}function Zg(i,e,t){const n=t?.html?ux(i):i;return`${lx(String(e),4)}: ${n}${t?.html?"<br/>":`
`}`}function lx(i,e){let t="";for(let n=i.length;n<e;++n)t+=" ";return t+i}function ux(i){return i.replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;")}class qr extends Q{get[Symbol.toStringTag](){return"Shader"}stage;source;compilationStatus="pending";constructor(e,t){t={...t,debugShaders:t.debugShaders||e.props.debugShaders||"errors"},super(e,{id:fx(t),...t},qr.defaultProps),this.stage=this.props.stage,this.source=this.props.source}getCompilationInfoSync(){return null}getTranslatedSource(){return null}async debugShader(){const e=this.props.debugShaders;switch(e){case"never":return;case"errors":if(this.compilationStatus==="success")return;break}try{const t=await this.getCompilationInfo();if(e==="warnings"&&t?.length===0)return;this._displayShaderLog(t,this.id)}catch(t){A.warn(`Shader ${this.id}: failed to fetch compilation info during debug logging`,t)()}}_displayShaderLog(e,t){if(typeof document>"u"||!document?.createElement)return;const n=t,s=`${this.stage} shader "${n}"`,r=ax(e,this.source,{showSourceCode:"all",html:!0}),o=this.getTranslatedSource(),a=document.createElement("div");a.innerHTML=`<h1>Compilation error in ${s}</h1>
<div style="display:flex;position:fixed;top:10px;right:20px;gap:2px;">
<button id="copy">Copy source</button><br/>
<button id="close">Close</button>
</div>
<code><pre>${r}</pre></code>`,o&&(a.innerHTML+=`<br /><h1>Translated Source</h1><br /><br /><code><pre>${o}</pre></code>`),a.style.top="0",a.style.left="0",a.style.background="white",a.style.position="fixed",a.style.zIndex="9999",a.style.maxWidth="100vw",a.style.maxHeight="100vh",a.style.overflowY="auto",document.body.appendChild(a),a.querySelector(".luma-compiler-log-error")?.scrollIntoView(),a.querySelector("button#close").onclick=()=>{a.remove()},a.querySelector("button#copy").onclick=()=>{navigator.clipboard.writeText(this.source)}}static defaultProps={...Q.defaultProps,language:"auto",stage:void 0,source:"",sourceMap:null,entryPoint:"main",debugShaders:void 0}}function fx(i){return dx(i.source)||i.id||ts(`unnamed ${i.stage}-shader`)}function dx(i,e="unnamed"){return/#define[\s*]SHADER_NAME[\s*]([A-Za-z0-9_-]+)[\s*]/.exec(i)?.[1]??e}class Zr extends Q{get[Symbol.toStringTag](){return"Framebuffer"}width;height;constructor(e,t={}){super(e,t,Zr.defaultProps),this.width=this.props.width,this.height=this.props.height}clone(e){const t=this.colorAttachments.map(s=>s.texture.clone(e)),n=this.depthStencilAttachment&&this.depthStencilAttachment.texture.clone(e);return this.device.createFramebuffer({...this.props,...e,colorAttachments:t,depthStencilAttachment:n})}resize(e){let t=!e;if(e){const[n,s]=Array.isArray(e)?e:[e.width,e.height];t=t||s!==this.height||n!==this.width,this.width=n,this.height=s}t&&(A.log(2,`Resizing framebuffer ${this.id} to ${this.width}x${this.height}`)(),this.resizeAttachments(this.width,this.height))}autoCreateAttachmentTextures(){if(this.props.colorAttachments.length===0&&!this.props.depthStencilAttachment)throw new Error("Framebuffer has noattachments");this.colorAttachments=this.props.colorAttachments.map((t,n)=>{if(typeof t=="string"){const s=this.createColorTexture(t,n);return this.attachResource(s),s.view}return t instanceof re?t.view:t});const e=this.props.depthStencilAttachment;if(e)if(typeof e=="string"){const t=this.createDepthStencilTexture(e);this.attachResource(t),this.depthStencilAttachment=t.view}else e instanceof re?this.depthStencilAttachment=e.view:this.depthStencilAttachment=e}createColorTexture(e,t){return this.device.createTexture({id:`${this.id}-color-attachment-${t}`,usage:re.RENDER_ATTACHMENT,format:e,width:this.width,height:this.height,sampler:{magFilter:"linear",minFilter:"linear"}})}createDepthStencilTexture(e){return this.device.createTexture({id:`${this.id}-depth-stencil-attachment`,usage:re.RENDER_ATTACHMENT|re.SAMPLE,format:e,width:this.width,height:this.height})}resizeAttachments(e,t){if(this.colorAttachments.forEach((n,s)=>{const r=n.texture.clone({width:e,height:t});this.destroyAttachedResource(n),this.colorAttachments[s]=r.view,this.attachResource(r.view)}),this.depthStencilAttachment){const n=this.depthStencilAttachment.texture.clone({width:e,height:t});this.destroyAttachedResource(this.depthStencilAttachment),this.depthStencilAttachment=n.view,this.attachResource(n)}this.updateAttachments()}static defaultProps={...Q.defaultProps,width:1,height:1,colorAttachments:[],depthStencilAttachment:null}}class Bt extends Q{get[Symbol.toStringTag](){return"RenderPipeline"}shaderLayout;bufferLayout;linkStatus="pending";hash="";sharedRenderPipeline=null;get isPending(){return this.linkStatus==="pending"||this.vs.compilationStatus==="pending"||this.fs?.compilationStatus==="pending"}get isErrored(){return this.linkStatus==="error"||this.vs.compilationStatus==="error"||this.fs?.compilationStatus==="error"}constructor(e,t){super(e,t,Bt.defaultProps),this.shaderLayout=this.props.shaderLayout,this.bufferLayout=this.props.bufferLayout||[],this.sharedRenderPipeline=this.props._sharedRenderPipeline||null}static defaultProps={...Q.defaultProps,vs:null,vertexEntryPoint:"vertexMain",vsConstants:{},fs:null,fragmentEntryPoint:"fragmentMain",fsConstants:{},shaderLayout:null,bufferLayout:[],topology:"triangle-list",colorAttachmentFormats:void 0,depthStencilAttachmentFormat:void 0,parameters:{},varyings:void 0,bufferMode:void 0,disableWarnings:!1,_sharedRenderPipeline:void 0,_uniformBlockLayouts:[],bindings:void 0,bindGroups:void 0}}class hx extends Q{get[Symbol.toStringTag](){return"SharedRenderPipeline"}constructor(e,t){super(e,t,{...Q.defaultProps,handle:void 0,vs:void 0,fs:void 0,varyings:void 0,bufferMode:void 0})}}class jn extends Q{get[Symbol.toStringTag](){return"ComputePipeline"}hash="";shaderLayout;constructor(e,t){super(e,t,jn.defaultProps),this.shaderLayout=t.shaderLayout}static defaultProps={...Q.defaultProps,shader:void 0,entryPoint:void 0,constants:{},shaderLayout:void 0}}class Xr{static defaultProps={...Bt.defaultProps};static getDefaultPipelineFactory(e){const t=e.getModuleData("@luma.gl/core");return t.defaultPipelineFactory||=new Xr(e),t.defaultPipelineFactory}device;_hashCounter=0;_hashes={};_renderPipelineCache={};_computePipelineCache={};_sharedRenderPipelineCache={};get[Symbol.toStringTag](){return"PipelineFactory"}toString(){return`PipelineFactory(${this.device.id})`}constructor(e){this.device=e}createRenderPipeline(e){if(!this.device.props._cachePipelines)return this.device.createRenderPipeline(e);const t={...Bt.defaultProps,...e},n=this._renderPipelineCache,s=this._hashRenderPipeline(t);let r=n[s]?.resource;if(r)n[s].useCount++,this.device.props.debugFactories&&A.log(3,`${this}: ${n[s].resource} reused, count=${n[s].useCount}, (id=${e.id})`)();else{const o=this.device.type==="webgl"&&this.device.props._sharePipelines?this.createSharedRenderPipeline(t):void 0;r=this.device.createRenderPipeline({...t,id:t.id?`${t.id}-cached`:ts("unnamed-cached"),_sharedRenderPipeline:o}),r.hash=s,n[s]={resource:r,useCount:1},this.device.props.debugFactories&&A.log(3,`${this}: ${r} created, count=${n[s].useCount}`)()}return r}createComputePipeline(e){if(!this.device.props._cachePipelines)return this.device.createComputePipeline(e);const t={...jn.defaultProps,...e},n=this._computePipelineCache,s=this._hashComputePipeline(t);let r=n[s]?.resource;return r?(n[s].useCount++,this.device.props.debugFactories&&A.log(3,`${this}: ${n[s].resource} reused, count=${n[s].useCount}, (id=${e.id})`)()):(r=this.device.createComputePipeline({...t,id:t.id?`${t.id}-cached`:void 0}),r.hash=s,n[s]={resource:r,useCount:1},this.device.props.debugFactories&&A.log(3,`${this}: ${r} created, count=${n[s].useCount}`)()),r}release(e){if(!this.device.props._cachePipelines){e.destroy();return}const t=this._getCache(e),n=e.hash;t[n].useCount--,t[n].useCount===0?(this._destroyPipeline(e),this.device.props.debugFactories&&A.log(3,`${this}: ${e} released and destroyed`)()):t[n].useCount<0?(A.error(`${this}: ${e} released, useCount < 0, resetting`)(),t[n].useCount=0):this.device.props.debugFactories&&A.log(3,`${this}: ${e} released, count=${t[n].useCount}`)()}createSharedRenderPipeline(e){const t=this._hashSharedRenderPipeline(e);let n=this._sharedRenderPipelineCache[t];return n||(n={resource:this.device._createSharedRenderPipelineWebGL(e),useCount:0},this._sharedRenderPipelineCache[t]=n),n.useCount++,n.resource}releaseSharedRenderPipeline(e){if(!e.sharedRenderPipeline)return;const t=this._hashSharedRenderPipeline(e.sharedRenderPipeline.props),n=this._sharedRenderPipelineCache[t];n&&(n.useCount--,n.useCount===0&&(n.resource.destroy(),delete this._sharedRenderPipelineCache[t]))}_destroyPipeline(e){const t=this._getCache(e);return this.device.props._destroyPipelines?(delete t[e.hash],e.destroy(),e instanceof Bt&&this.releaseSharedRenderPipeline(e),!0):!1}_getCache(e){let t;if(e instanceof jn&&(t=this._computePipelineCache),e instanceof Bt&&(t=this._renderPipelineCache),!t)throw new Error(`${this}`);if(!t[e.hash])throw new Error(`${this}: ${e} matched incorrect entry`);return t}_hashComputePipeline(e){const{type:t}=this.device,n=this._getHash(e.shader.source),s=this._getHash(JSON.stringify(e.shaderLayout));return`${t}/C/${n}SL${s}`}_hashRenderPipeline(e){const t=e.vs?this._getHash(e.vs.source):0,n=e.fs?this._getHash(e.fs.source):0,s=this._getWebGLVaryingHash(e),r=this._getHash(JSON.stringify(e.shaderLayout)),o=this._getHash(JSON.stringify(e._uniformBlockLayouts)),a=this._getHash(JSON.stringify(e.bufferLayout)),{type:c}=this.device;if(c==="webgl"){const l=this._getHash(JSON.stringify(e.parameters));return`${c}/R/${t}/${n}V${s}T${e.topology}P${l}SL${r}UBL${o}BL${a}`}else{const u=this._getHash(JSON.stringify({vertexEntryPoint:e.vertexEntryPoint,fragmentEntryPoint:e.fragmentEntryPoint})),f=this._getHash(JSON.stringify(e.parameters)),d=this._getWebGPUAttachmentHash(e);return`${c}/R/${t}/${n}V${s}T${e.topology}EP${u}P${f}SL${r}BL${a}A${d}`}}_hashSharedRenderPipeline(e){const t=e.vs?this._getHash(e.vs.source):0,n=e.fs?this._getHash(e.fs.source):0,s=this._getWebGLVaryingHash(e);return`webgl/S/${t}/${n}V${s}`}_getHash(e){return this._hashes[e]===void 0&&(this._hashes[e]=this._hashCounter++),this._hashes[e]}_getWebGLVaryingHash(e){const{varyings:t=[],bufferMode:n=null}=e;return this._getHash(JSON.stringify({varyings:t,bufferMode:n}))}_getWebGPUAttachmentHash(e){const t=e.colorAttachmentFormats??[this.device.preferredColorFormat],n=e.depthStencilAttachmentFormat??(e.parameters?.depthWriteEnabled?this.device.preferredDepthFormat:null);return this._getHash(JSON.stringify({colorAttachmentFormats:t,depthStencilAttachmentFormat:n}))}}class Kr{static defaultProps={...qr.defaultProps};static getDefaultShaderFactory(e){const t=e.getModuleData("@luma.gl/core");return t.defaultShaderFactory||=new Kr(e),t.defaultShaderFactory}device;_cache={};get[Symbol.toStringTag](){return"ShaderFactory"}toString(){return`${this[Symbol.toStringTag]}(${this.device.id})`}constructor(e){this.device=e}createShader(e){if(!this.device.props._cacheShaders)return this.device.createShader(e);const t=this._hashShader(e);let n=this._cache[t];if(n)n.useCount++,this.device.props.debugFactories&&A.log(3,`${this}: Reusing shader ${n.resource.id} count=${n.useCount}`)();else{const s=this.device.createShader({...e,id:e.id?`${e.id}-cached`:void 0});this._cache[t]=n={resource:s,useCount:1},this.device.props.debugFactories&&A.log(3,`${this}: Created new shader ${s.id}`)()}return n.resource}release(e){if(!this.device.props._cacheShaders){e.destroy();return}const t=this._hashShader(e),n=this._cache[t];if(n)if(n.useCount--,n.useCount===0)this.device.props._destroyShaders&&(delete this._cache[t],n.resource.destroy(),this.device.props.debugFactories&&A.log(3,`${this}: Releasing shader ${e.id}, destroyed`)());else{if(n.useCount<0)throw new Error(`ShaderFactory: Shader ${e.id} released too many times`);this.device.props.debugFactories&&A.log(3,`${this}: Releasing shader ${e.id} count=${n.useCount}`)()}}_hashShader(e){return`${e.stage}:${e.source}`}}function Xg(i,e,t){const n=i.bindings.find(s=>s.name===e||`${s.name.toLocaleLowerCase()}uniforms`===e.toLocaleLowerCase());return!n&&!t?.ignoreWarnings&&A.warn(`Binding ${e} not set: Not found in shader layout.`)(),n||null}function ol(i,e){if(!e)return{};if(gx(e))return Object.fromEntries(Object.entries(e).map(([s,r])=>[Number(s),{...r}]));const t={};for(const[n,s]of Object.entries(e)){const o=Xg(i,n)?.group??0;t[o]||={},t[o][n]=s}return t}function tc(i){const e={};for(const t of Object.values(i))Object.assign(e,t);return e}function gx(i){const e=Object.keys(i);return e.length>0&&e.every(t=>/^\d+$/.test(t))}class Qt extends Q{static defaultClearColor=[0,0,0,1];static defaultClearDepth=1;static defaultClearStencil=0;get[Symbol.toStringTag](){return"RenderPass"}constructor(e,t,n=Qt.defaultProps){t=Qt.normalizeProps(e,t),super(e,t,n)}static normalizeProps(e,t){return t}static defaultProps={...Q.defaultProps,framebuffer:null,resolveTargets:void 0,parameters:void 0,clearColor:Qt.defaultClearColor,clearColors:void 0,clearDepth:Qt.defaultClearDepth,clearStencil:Qt.defaultClearStencil,depthReadOnly:!1,stencilReadOnly:!1,discard:!1,occlusionQuerySet:void 0,timestampQuerySet:void 0,beginTimestampIndex:void 0,endTimestampIndex:void 0}}class al extends Q{get[Symbol.toStringTag](){return"CommandEncoder"}_timeProfilingQuerySet=null;_timeProfilingSlotCount=0;_gpuTimeMs;constructor(e,t){super(e,t,al.defaultProps),this._timeProfilingQuerySet=t.timeProfilingQuerySet??null,this._timeProfilingSlotCount=0,this._gpuTimeMs=void 0}async resolveTimeProfilingQuerySet(){if(this._gpuTimeMs=void 0,!this._timeProfilingQuerySet)return;const e=Math.floor(this._timeProfilingSlotCount/2);if(e<=0)return;const t=e*2,n=await this._timeProfilingQuerySet.readResults({firstQuery:0,queryCount:t});let s=0n;for(let r=0;r<t;r+=2)s+=n[r+1]-n[r];this._gpuTimeMs=Number(s)/1e6}getTimeProfilingSlotCount(){return this._timeProfilingSlotCount}getTimeProfilingQuerySet(){return this._timeProfilingQuerySet}_applyTimeProfilingToPassProps(e){const t=e||{};if(!this._supportsTimestampQueries()||!this._timeProfilingQuerySet||t.timestampQuerySet!==void 0||t.beginTimestampIndex!==void 0||t.endTimestampIndex!==void 0)return t;const n=this._timeProfilingSlotCount;return n+1>=this._timeProfilingQuerySet.props.count?t:(this._timeProfilingSlotCount+=2,{...t,timestampQuerySet:this._timeProfilingQuerySet,beginTimestampIndex:n,endTimestampIndex:n+1})}_supportsTimestampQueries(){return this.device.features.has("timestamp-query")}static defaultProps={...Q.defaultProps,measureExecutionTime:void 0,timeProfilingQuerySet:void 0}}class cl extends Q{get[Symbol.toStringTag](){return"CommandBuffer"}constructor(e,t){super(e,t,cl.defaultProps)}static defaultProps={...Q.defaultProps}}class ll extends Q{static defaultProps={...Q.defaultProps,shaderLayout:void 0,bufferLayout:[]};get[Symbol.toStringTag](){return"VertexArray"}maxVertexAttributes;indexBuffer=null;attributes;constructor(e,t){super(e,t,ll.defaultProps),this.maxVertexAttributes=e.limits.maxVertexAttributes,this.attributes=new Array(this.maxVertexAttributes).fill(null)}getBufferSlot(e){return null}getDrawValidationError(){return null}setConstantWebGL(e,t){this.device.reportError(new Error("constant attributes not supported"),this)()}}class ul extends Q{static defaultProps={...Q.defaultProps,layout:void 0,buffers:{}};get[Symbol.toStringTag](){return"TransformFeedback"}constructor(e,t){super(e,t,ul.defaultProps)}}class fl extends Q{get[Symbol.toStringTag](){return"QuerySet"}constructor(e,t){super(e,t,fl.defaultProps)}static defaultProps={...Q.defaultProps,type:void 0,count:void 0}}class dl extends Q{static defaultProps={...Q.defaultProps};get[Symbol.toStringTag](){return"Fence"}constructor(e,t={}){super(e,t,dl.defaultProps)}}function hl(i){const e=gl(i),t=vx[e];if(!t)throw new Error(`Unsupported variable shader type: ${i}`);return t}function px(i){const e=Kg(i),t=bx[e];if(!t)throw new Error(`Unsupported attribute shader type: ${i}`);const[n,s]=t,r=n==="i32"||n==="u32",o=n!=="u32",a=_x[n]*s;return{primitiveType:n,components:s,byteLength:a,integer:r,signed:o}}class mx{getVariableShaderTypeInfo(e){return hl(e)}getAttributeShaderTypeInfo(e){return px(e)}makeShaderAttributeType(e,t){return yx(e,t)}resolveAttributeShaderTypeAlias(e){return Kg(e)}resolveVariableShaderTypeAlias(e){return gl(e)}}function yx(i,e){return e===1?i:`vec${e}<${i}>`}function Kg(i){return xx[i]||i}function gl(i){return wx[i]||i}const sn=new mx,_x={f32:4,f16:2,i32:4,u32:4},bx={f32:["f32",1],"vec2<f32>":["f32",2],"vec3<f32>":["f32",3],"vec4<f32>":["f32",4],f16:["f16",1],"vec2<f16>":["f16",2],"vec3<f16>":["f16",3],"vec4<f16>":["f16",4],i32:["i32",1],"vec2<i32>":["i32",2],"vec3<i32>":["i32",3],"vec4<i32>":["i32",4],u32:["u32",1],"vec2<u32>":["u32",2],"vec3<u32>":["u32",3],"vec4<u32>":["u32",4]},vx={f32:{type:"f32",components:1},f16:{type:"f16",components:1},i32:{type:"i32",components:1},u32:{type:"u32",components:1},"vec2<f32>":{type:"f32",components:2},"vec3<f32>":{type:"f32",components:3},"vec4<f32>":{type:"f32",components:4},"vec2<f16>":{type:"f16",components:2},"vec3<f16>":{type:"f16",components:3},"vec4<f16>":{type:"f16",components:4},"vec2<i32>":{type:"i32",components:2},"vec3<i32>":{type:"i32",components:3},"vec4<i32>":{type:"i32",components:4},"vec2<u32>":{type:"u32",components:2},"vec3<u32>":{type:"u32",components:3},"vec4<u32>":{type:"u32",components:4},"mat2x2<f32>":{type:"f32",components:4},"mat2x3<f32>":{type:"f32",components:6},"mat2x4<f32>":{type:"f32",components:8},"mat3x2<f32>":{type:"f32",components:6},"mat3x3<f32>":{type:"f32",components:9},"mat3x4<f32>":{type:"f32",components:12},"mat4x2<f32>":{type:"f32",components:8},"mat4x3<f32>":{type:"f32",components:12},"mat4x4<f32>":{type:"f32",components:16},"mat2x2<f16>":{type:"f16",components:4},"mat2x3<f16>":{type:"f16",components:6},"mat2x4<f16>":{type:"f16",components:8},"mat3x2<f16>":{type:"f16",components:6},"mat3x3<f16>":{type:"f16",components:9},"mat3x4<f16>":{type:"f16",components:12},"mat4x2<f16>":{type:"f16",components:8},"mat4x3<f16>":{type:"f16",components:12},"mat4x4<f16>":{type:"f16",components:16},"mat2x2<i32>":{type:"i32",components:4},"mat2x3<i32>":{type:"i32",components:6},"mat2x4<i32>":{type:"i32",components:8},"mat3x2<i32>":{type:"i32",components:6},"mat3x3<i32>":{type:"i32",components:9},"mat3x4<i32>":{type:"i32",components:12},"mat4x2<i32>":{type:"i32",components:8},"mat4x3<i32>":{type:"i32",components:12},"mat4x4<i32>":{type:"i32",components:16},"mat2x2<u32>":{type:"u32",components:4},"mat2x3<u32>":{type:"u32",components:6},"mat2x4<u32>":{type:"u32",components:8},"mat3x2<u32>":{type:"u32",components:6},"mat3x3<u32>":{type:"u32",components:9},"mat3x4<u32>":{type:"u32",components:12},"mat4x2<u32>":{type:"u32",components:8},"mat4x3<u32>":{type:"u32",components:12},"mat4x4<u32>":{type:"u32",components:16}},xx={vec2i:"vec2<i32>",vec3i:"vec3<i32>",vec4i:"vec4<i32>",vec2u:"vec2<u32>",vec3u:"vec3<u32>",vec4u:"vec4<u32>",vec2f:"vec2<f32>",vec3f:"vec3<f32>",vec4f:"vec4<f32>",vec2h:"vec2<f16>",vec3h:"vec3<f16>",vec4h:"vec4<f16>"},wx={vec2i:"vec2<i32>",vec3i:"vec3<i32>",vec4i:"vec4<i32>",vec2u:"vec2<u32>",vec3u:"vec3<u32>",vec4u:"vec4<u32>",vec2f:"vec2<f32>",vec3f:"vec3<f32>",vec4f:"vec4<f32>",vec2h:"vec2<f16>",vec3h:"vec3<f16>",vec4h:"vec4<f16>",mat2x2f:"mat2x2<f32>",mat2x3f:"mat2x3<f32>",mat2x4f:"mat2x4<f32>",mat3x2f:"mat3x2<f32>",mat3x3f:"mat3x3<f32>",mat3x4f:"mat3x4<f32>",mat4x2f:"mat4x2<f32>",mat4x3f:"mat4x3<f32>",mat4x4f:"mat4x4<f32>",mat2x2i:"mat2x2<i32>",mat2x3i:"mat2x3<i32>",mat2x4i:"mat2x4<i32>",mat3x2i:"mat3x2<i32>",mat3x3i:"mat3x3<i32>",mat3x4i:"mat3x4<i32>",mat4x2i:"mat4x2<i32>",mat4x3i:"mat4x3<i32>",mat4x4i:"mat4x4<i32>",mat2x2u:"mat2x2<u32>",mat2x3u:"mat2x3<u32>",mat2x4u:"mat2x4<u32>",mat3x2u:"mat3x2<u32>",mat3x3u:"mat3x3<u32>",mat3x4u:"mat3x4<u32>",mat4x2u:"mat4x2<u32>",mat4x3u:"mat4x3<u32>",mat4x4u:"mat4x4<u32>",mat2x2h:"mat2x2<f16>",mat2x3h:"mat2x3<f16>",mat2x4h:"mat2x4<f16>",mat3x2h:"mat3x2<f16>",mat3x3h:"mat3x3<f16>",mat3x4h:"mat3x4<f16>",mat4x2h:"mat4x2<f16>",mat4x3h:"mat4x3<f16>",mat4x4h:"mat4x4<f16>"};function pl(i,e={}){const t={...i},n=e.layout??"std140",s={};let r=0;for(const[o,a]of Object.entries(t))r=ic(s,o,a,r,n);return r=ut(r,Vt(t,n)),{layout:n,byteLength:r*4,uniformTypes:t,fields:s}}function Qr(i,e){const t=gl(i),n=hl(t),s=/^mat(\d)x(\d)<.+>$/.exec(t);if(s){const o=Number(s[1]),a=Number(s[2]),c=rf(a,t,n.type),l=Sx(c.size,c.alignment,e);return{alignment:c.alignment,size:o*l,components:o*a,columns:o,rows:a,columnStride:l,shaderType:t,type:n.type}}const r=/^vec(\d)<.+>$/.exec(t);return r?rf(Number(r[1]),t,n.type):{alignment:1,size:1,components:1,columns:1,rows:1,columnStride:1,shaderType:t,type:n.type}}function Qg(i){return!!i&&typeof i=="object"&&!Array.isArray(i)}function ic(i,e,t,n,s){if(typeof t=="string"){const r=Qr(t,s),o=ut(n,r.alignment);return i[e]={offset:o,...r},o+r.size}if(Array.isArray(t)){if(Array.isArray(t[0]))throw new Error(`Nested arrays are not supported for ${e}`);const r=t[0],o=t[1],a=ep(r,s),c=ut(n,Vt(t,s));for(let l=0;l<o;l++)ic(i,`${e}[${l}]`,r,c+l*a,s);return c+a*o}if(Qg(t)){const r=Vt(t,s);let o=ut(n,r);for(const[a,c]of Object.entries(t))o=ic(i,`${e}.${a}`,c,o,s);return ut(o,r)}throw new Error(`Unsupported CompositeShaderType for ${e}`)}function Jg(i,e){if(typeof i=="string")return Qr(i,e).size;if(Array.isArray(i)){const n=i[0],s=i[1];if(Array.isArray(n))throw new Error("Nested arrays are not supported");return ep(n,e)*s}let t=0;for(const n of Object.values(i)){const s=n;t=ut(t,Vt(s,e)),t+=Jg(s,e)}return ut(t,Vt(i,e))}function Vt(i,e){if(typeof i=="string")return Qr(i,e).alignment;if(Array.isArray(i)){const n=i[0],s=Vt(n,e);return tp(e)?Math.max(s,4):s}let t=1;for(const n of Object.values(i)){const s=Vt(n,e);t=Math.max(t,s)}return Ex(e)?Math.max(t,4):t}function rf(i,e,t,n){return{alignment:i===2?2:4,size:i===3?3:i,components:i,columns:1,rows:i,columnStride:i===3?3:i,shaderType:e,type:t}}function ep(i,e){const t=Jg(i,e),n=Vt(i,e);return Px(t,n,e)}function Px(i,e,t){return ut(i,tp(t)?4:e)}function Sx(i,e,t){return t==="std140"?4:ut(i,e)}function tp(i){return i==="std140"||i==="wgsl-uniform"}function Ex(i){return i==="std140"||i==="wgsl-uniform"}let bs;function ip(i){return(!bs||bs.byteLength<i)&&(bs=new ArrayBuffer(i)),bs}function Cx(i,e){const t=ip(i.BYTES_PER_ELEMENT*e);return new i(t,0,e)}function Lx(i){return ArrayBuffer.isView(i)&&!(i instanceof DataView)}function xr(i){return Array.isArray(i)?i.length===0||typeof i[0]=="number":Lx(i)}class Tx{layout;constructor(e){this.layout=e}has(e){return!!this.layout.fields[e]}get(e){const t=this.layout.fields[e];return t?{offset:t.offset,size:t.size}:void 0}getFlatUniformValues(e){const t={};for(const[n,s]of Object.entries(e)){const r=this.layout.uniformTypes[n];r?this._flattenCompositeValue(t,n,r,s):this.layout.fields[n]&&(t[n]=s)}return t}getData(e){const t=ip(this.layout.byteLength);new Uint8Array(t,0,this.layout.byteLength).fill(0);const n={i32:new Int32Array(t),u32:new Uint32Array(t),f32:new Float32Array(t),f16:new Uint16Array(t)},s=this.getFlatUniformValues(e);for(const[r,o]of Object.entries(s))this._writeLeafValue(n,r,o);return new Uint8Array(t,0,this.layout.byteLength)}_flattenCompositeValue(e,t,n,s){if(s!==void 0){if(typeof n=="string"||this.layout.fields[t]){e[t]=s;return}if(Array.isArray(n)){const r=n[0],o=n[1];if(Array.isArray(r))throw new Error(`Nested arrays are not supported for ${t}`);if(typeof r=="string"&&xr(s)){this._flattenPackedArray(e,t,r,o,s);return}if(!Array.isArray(s)){A.warn(`Unsupported uniform array value for ${t}:`,s)();return}for(let a=0;a<Math.min(s.length,o);a++){const c=s[a];c!==void 0&&this._flattenCompositeValue(e,`${t}[${a}]`,r,c)}return}if(Qg(n)&&Ax(s)){for(const[r,o]of Object.entries(s)){if(o===void 0)continue;const a=`${t}.${r}`;this._flattenCompositeValue(e,a,n[r],o)}return}A.warn(`Unsupported uniform value for ${t}:`,s)()}}_flattenPackedArray(e,t,n,s,r){const o=r,c=Qr(n,this.layout.layout).components;for(let l=0;l<s;l++){const u=l*c;if(u>=o.length)break;c===1?e[`${t}[${l}]`]=Number(o[u]):e[`${t}[${l}]`]=Mx(r,u,u+c)}}_writeLeafValue(e,t,n){const s=this.layout.fields[t];if(!s){A.warn(`Uniform ${t} not found in layout`)();return}const{type:r,components:o,columns:a,rows:c,offset:l,columnStride:u}=s,f=e[r];if(o===1){f[l]=Number(n);return}const d=n;if(a===1){for(let g=0;g<o;g++)f[l+g]=Number(d[g]??0);return}let h=0;for(let g=0;g<a;g++){const p=l+g*u;for(let m=0;m<c;m++)f[p+m]=Number(d[h++]??0)}}}function Ax(i){return!!i&&typeof i=="object"&&!Array.isArray(i)&&!ArrayBuffer.isView(i)}function Mx(i,e,t){return Array.prototype.slice.call(i,e,t)}const Ix=128;function Rx(i,e,t=16){if(i===e)return!0;const n=i,s=e;if(!xr(n)||!xr(s)||n.length!==s.length)return!1;const r=Math.min(t,Ix);if(n.length>r)return!1;for(let o=0;o<n.length;++o)if(s[o]!==n[o])return!1;return!0}function Ox(i){return xr(i)?i.slice():i}class kx{name;uniforms={};modifiedUniforms={};modified=!0;bindingLayout={};needsRedraw="initialized";constructor(e){if(this.name=e?.name||"unnamed",e?.name&&e?.shaderLayout){const t=e?.shaderLayout.bindings?.find(s=>s.type==="uniform"&&s.name===e?.name);if(!t)throw new Error(e?.name);const n=t;for(const s of n.uniforms||[])this.bindingLayout[s.name]=s}}setUniforms(e){for(const[t,n]of Object.entries(e))this._setUniform(t,n)&&!this.needsRedraw&&this.setNeedsRedraw(`${this.name}.${t}=${n}`)}setNeedsRedraw(e){this.needsRedraw=this.needsRedraw||e}getAllUniforms(){return this.modifiedUniforms={},this.needsRedraw=!1,this.uniforms||{}}_setUniform(e,t){return Rx(this.uniforms[e],t)?!1:(this.uniforms[e]=Ox(t),this.modifiedUniforms[e]=!0,this.modified=!0,!0)}}const Bx=1024;class np{device;uniformBlocks=new Map;shaderBlockLayouts=new Map;shaderBlockWriters=new Map;uniformBuffers=new Map;constructor(e,t){this.device=e;for(const[n,s]of Object.entries(t)){const r=n,o=pl(s.uniformTypes??{},{layout:s.layout??Dx(e)}),a=new Tx(o);this.shaderBlockLayouts.set(r,o),this.shaderBlockWriters.set(r,a);const c=new kx({name:n});c.setUniforms(a.getFlatUniformValues(s.defaultUniforms||{})),this.uniformBlocks.set(r,c)}}destroy(){for(const e of this.uniformBuffers.values())e.destroy()}setUniforms(e,t){for(const[n,s]of Object.entries(e)){const r=n,a=this.shaderBlockWriters.get(r)?.getFlatUniformValues(s||{});this.uniformBlocks.get(r)?.setUniforms(a||{})}this.updateUniformBuffers(t)}getUniformBufferByteLength(e){const t=this.shaderBlockLayouts.get(e)?.byteLength||0;return Math.max(t,Bx)}getUniformBufferData(e){const t=this.uniformBlocks.get(e)?.getAllUniforms()||{};return this.shaderBlockWriters.get(e)?.getData(t)||new Uint8Array(0)}createUniformBuffer(e,t){t&&this.setUniforms(t);const n=this.getUniformBufferByteLength(e),s=this.device.createBuffer({usage:q.UNIFORM|q.COPY_DST,byteLength:n}),r=this.getUniformBufferData(e);return s.write(r),s}getManagedUniformBuffer(e){if(!this.uniformBuffers.get(e)){const t=this.getUniformBufferByteLength(e),n=this.device.createBuffer({usage:q.UNIFORM|q.COPY_DST,byteLength:t});this.uniformBuffers.set(e,n)}return this.uniformBuffers.get(e)}updateUniformBuffers(e){let t=!1;for(const n of this.uniformBlocks.keys()){const s=this.updateUniformBuffer(n,e);t||=s}return t&&A.log(3,`UniformStore.updateUniformBuffers(): ${t}`)(),t}updateUniformBuffer(e,t){const n=this.uniformBlocks.get(e);let s=this.uniformBuffers.get(e),r=!1;if(s&&n?.needsRedraw){r||=n.needsRedraw;const o=this.getUniformBufferData(e);s=this.uniformBuffers.get(e),s&&(t?this.device.writeBufferViaCommandEncoder(t,s,o):s.write(o));const a=this.uniformBlocks.get(e)?.getAllUniforms();A.log(4,`Writing to uniform buffer ${String(e)}`,o,a)()}return r}}function Dx(i){return i.type==="webgpu"?"wgsl-uniform":"std140"}function nc(i){return i.attributes?i.attributes.map(e=>e.attribute):[i.name]}function Fx(i){return Object.fromEntries(i.attributes.map(e=>[e.name,e.location]))}function of(i){let e=1/0;for(const t of i)t!==void 0&&(e=Math.min(e,t));return e}function zx(i,e,t){Nx(e);const n=new Map;for(const s of e){const r=Ux(s);if(s.attributes)for(const o of s.attributes)n.has(o.attribute)||n.set(o.attribute,{bufferName:s.name,stepMode:s.stepMode,vertexFormat:o.format,byteOffset:o.byteOffset,byteStride:r});else s.format&&!n.has(s.name)&&n.set(s.name,{bufferName:s.name,stepMode:s.stepMode,vertexFormat:s.format,byteOffset:0,byteStride:r})}return i.attributes.map(s=>{const r=n.get(s.name);!r&&t?.warnOnMissingBufferLayout&&A.warn(`layout for attribute "${s.name}" not present in buffer layout`)();const o=sn.getAttributeShaderTypeInfo(s.type),a=r?.vertexFormat||Ee.getCompatibleVertexFormat(o);return{attributeName:s.name,bufferName:r?.bufferName||s.name,location:s.location,vertexFormat:a,byteOffset:r?.byteOffset??0,byteStride:r?.byteStride??Ee.getVertexFormatInfo(a).byteLength,stepMode:r?.stepMode||s.stepMode||(s.name.startsWith("instance")?"instance":"vertex")}}).sort((s,r)=>s.location-r.location)}function Nx(i){for(const e of i)(e.attributes&&e.format||!e.attributes&&!e.format)&&A.warn(`BufferLayout ${e.name} must have either 'attributes' or 'format' field`)()}function Ux(i){if(typeof i.byteStride=="number")return i.byteStride;if(i.attributes){let e=0;for(const t of i.attributes)e+=Ee.getVertexFormatInfo(t.format).byteLength;return e}return Ee.getVertexFormatInfo(i.format).byteLength}function sp(i,e){const t={},n=zx(i,e,{warnOnMissingBufferLayout:!0});for(const s of n){const r=$x(i,s);t[s.attributeName]=r}return t}function $x(i,e){const t=Gx(i,e.attributeName),n=sn.getAttributeShaderTypeInfo(t.type),s=e.vertexFormat,r=Ee.getVertexFormatInfo(s);return{attributeName:e.attributeName,bufferName:e.bufferName,location:t.location,shaderType:t.type,primitiveType:n.primitiveType,shaderComponents:n.components,vertexFormat:s,bufferDataType:r.type,bufferComponents:r.components,normalized:r.normalized,integer:n.integer,stepMode:e.stepMode,byteOffset:e.byteOffset,byteStride:e.byteStride}}function Gx(i,e){const t=i.attributes.find(n=>n.name===e);return t||A.warn(`shader layout attribute "${e}" not present in shader`)(),t||null}const Vx=/^(vs|fs):(?:#(?:decl|main-start|main-end)|[A-Za-z_][\w-]*)$/;function rp(i=[],e){const t=[],n={},s={},r={},o={};for(const a of i)af({modules:t,defines:n,injections:s,vertexInputs:r,varyings:o},a),af({modules:t,defines:n,injections:s,vertexInputs:r,varyings:o},a[e]);for(const a of Object.keys(o))if(r[a])throw new Error(`ShaderPlugin name "${a}" cannot be both a vertex input and a varying`);return{modules:t,defines:n,injections:s,vertexInputs:r,varyings:o}}function op(i=[],e=[]){const t=[...i],n=new Set(t.map(s=>s.name));for(const s of e)n.has(s.name)||(t.push(s),n.add(s.name));return t}function af(i,e){if(e){e.modules?.length&&i.modules.push(...e.modules),e.defines&&Object.assign(i.defines,e.defines);for(const[t,n]of Object.entries(e.vertexInputs||{})){cf(t,"vertex input");const s=i.vertexInputs[t];if(s&&s!==n)throw new Error(`ShaderPlugin vertex input "${t}" has conflicting types "${s}" and "${n}"`);i.vertexInputs[t]=n}for(const[t,n]of Object.entries(e.varyings||{})){cf(t,"varying");const s=jx(t,n),r=i.varyings[t];if(r&&(r.type!==s.type||r.interpolation!==s.interpolation))throw new Error(`ShaderPlugin varying "${t}" has conflicting declarations "${r.type}/${r.interpolation}" and "${s.type}/${s.interpolation}"`);i.varyings[t]=s}for(const t of e.injections||[])Wx(t.target),i.injections[t.target]||(i.injections[t.target]=[]),i.injections[t.target].push({injection:t.injection,order:t.order??0})}}function cf(i,e){if(!/^[A-Za-z_][A-Za-z0-9_]*$/.test(i)||i.startsWith("_luma_"))throw new Error(`ShaderPlugin ${e} "${i}" must be a valid non-reserved identifier`)}function jx(i,e){const{primitiveType:t}=sn.getAttributeShaderTypeInfo(e.type),n=t==="i32"||t==="u32",s=e.interpolation||(n?"flat":"smooth");if(n&&s==="smooth")throw new Error(`ShaderPlugin integer varying "${i}" must use flat interpolation`);return{type:e.type,interpolation:s}}function Wx(i){if(!Vx.test(i))throw new Error(`ShaderPlugin injection target "${i}" must be a named shader anchor or hook`)}const Hx=/^(?:uniform\s+)?(?:(?:lowp|mediump|highp)\s+)?[A-Za-z0-9_]+(?:<[^>]+>)?\s+([A-Za-z0-9_]+)(?:\s*\[[^\]]+\])?\s*;/,Yx=/((?:layout\s*\([^)]*\)\s*)*)uniform\s+([A-Za-z_][A-Za-z0-9_]*)\s*\{([\s\S]*?)\}\s*([A-Za-z_][A-Za-z0-9_]*)?\s*;/g;function ml(i){return`${i.name}Uniforms`}function qx(i,e){const t=e==="wgsl"?i.source:e==="vertex"?i.vs:i.fs;if(!t)return null;const n=ml(i);return Qx(t,e==="wgsl"?"wgsl":"glsl",n)}function Zx(i,e){const t=Object.keys(i.uniformTypes||{});if(!t.length)return null;const n=qx(i,e);return n?{moduleName:i.name,uniformBlockName:ml(i),stage:e,expectedUniformNames:t,actualUniformNames:n,matches:tw(t,n)}:null}function Xx(i,e,t={}){const n=Zx(i,e);if(!n||n.matches)return n;const s=iw(n);return t.log?.error?.(s,n)(),t.throwOnError!==!1&&tn(!1,s),n}function yl(i){const e=[],t=nw(i);for(const n of t.matchAll(Yx)){const s=n[1]?.trim()||null;e.push({blockName:n[2],body:n[3],instanceName:n[4]||null,layoutQualifier:s,hasLayoutQualifier:!!s,isStd140:!!(s&&/\blayout\s*\([^)]*\bstd140\b[^)]*\)/.exec(s))})}return e}function Kx(i,e,t,n){const s=yl(i).filter(o=>!o.isStd140),r=new Set;for(const o of s){if(r.has(o.blockName))continue;r.add(o.blockName);const a="",c=o.hasLayoutQualifier?`declares ${sw(o.layoutQualifier)} instead of layout(std140)`:"does not declare layout(std140)",l=`${a}${e} shader uniform block ${o.blockName} ${c}. luma.gl host-side shader block packing assumes explicit layout(std140) for GLSL uniform blocks. Add \`layout(std140)\` to the block declaration.`;t?.warn?.(l,o)()}return s}function Qx(i,e,t){const n=e==="wgsl"?Jx(i,t):ew(i,t);if(!n)return null;const s=[];for(const r of n.split(`
`)){const o=r.replace(/\/\/.*$/,"").trim();if(!o||o.startsWith("#"))continue;const a=e==="wgsl"?o.match(/^([A-Za-z0-9_]+)\s*:/):o.match(Hx);a&&s.push(a[1])}return s}function Jx(i,e){const t=new RegExp(`\\bstruct\\s+${e}\\b`,"m").exec(i);if(!t)return null;const n=i.indexOf("{",t.index);if(n<0)return null;let s=0;for(let r=n;r<i.length;r++){const o=i[r];if(o==="{"){s++;continue}if(o==="}"&&(s--,s===0))return i.slice(n+1,r)}return null}function ew(i,e){return yl(i).find(n=>n.blockName===e)?.body||null}function tw(i,e){if(i.length!==e.length)return!1;for(let t=0;t<i.length;t++)if(i[t]!==e[t])return!1;return!0}function iw(i){const{expectedUniformNames:e,actualUniformNames:t}=i,n=e.filter(a=>!t.includes(a)),s=t.filter(a=>!e.includes(a)),r=[`Expected ${e.length} fields, found ${t.length}.`],o=rw(e,t);return o&&r.push(o),n.length&&r.push(`Missing from shader block (${n.length}): ${lf(n)}.`),s.length&&r.push(`Unexpected in shader block (${s.length}): ${lf(s)}.`),e.length<=12&&t.length<=12&&(n.length||s.length)&&(r.push(`Expected: ${e.join(", ")}.`),r.push(`Actual: ${t.join(", ")}.`)),`${i.moduleName}: ${i.stage} shader uniform block ${i.uniformBlockName} does not match module.uniformTypes. ${r.join(" ")}`}function nw(i){return i.replace(/\/\*[\s\S]*?\*\//g,"").replace(/\/\/.*$/gm,"")}function sw(i){return i.replace(/\s+/g," ").trim()}function rw(i,e){const t=Math.min(i.length,e.length);for(let n=0;n<t;n++)if(i[n]!==e[n])return`First mismatch at field ${n+1}: expected ${i[n]}, found ${e[n]}.`;return i.length>e.length?`Shader block ends after field ${e.length}; expected next field ${i[e.length]}.`:e.length>i.length?`Shader block has extra field ${e.length}: ${e[i.length]}.`:null}function lf(i,e=8){if(i.length<=e)return i.join(", ");const t=i.length-e;return`${i.slice(0,e).join(", ")}, ... (${t} more)`}function ow(i){switch(i?.gpu.toLowerCase()){case"apple":return`#define APPLE_GPU
// Apple optimizes away the calculation necessary for emulated fp64
#define LUMA_FP64_CODE_ELIMINATION_WORKAROUND 1
#define LUMA_FP32_TAN_PRECISION_WORKAROUND 1
// Intel GPU doesn't have full 32 bits precision in same cases, causes overflow
#define LUMA_FP64_HIGH_BITS_OVERFLOW_WORKAROUND 1
`;case"nvidia":return`#define NVIDIA_GPU
// Nvidia optimizes away the calculation necessary for emulated fp64
#define LUMA_FP64_CODE_ELIMINATION_WORKAROUND 1
`;case"intel":return`#define INTEL_GPU
// Intel optimizes away the calculation necessary for emulated fp64
#define LUMA_FP64_CODE_ELIMINATION_WORKAROUND 1
// Intel's built-in 'tan' function doesn't have acceptable precision
#define LUMA_FP32_TAN_PRECISION_WORKAROUND 1
// Intel GPU doesn't have full 32 bits precision in same cases, causes overflow
#define LUMA_FP64_HIGH_BITS_OVERFLOW_WORKAROUND 1
`;case"amd":return`#define AMD_GPU
`;default:return`#define DEFAULT_GPU
// Prevent driver from optimizing away the calculation necessary for emulated fp64
#define LUMA_FP64_CODE_ELIMINATION_WORKAROUND 1
// Headless Chrome's software shader 'tan' function doesn't have acceptable precision
#define LUMA_FP32_TAN_PRECISION_WORKAROUND 1
// If the GPU doesn't have full 32 bits precision, will causes overflow
#define LUMA_FP64_HIGH_BITS_OVERFLOW_WORKAROUND 1
`}}function aw(i,e){if(Number(i.match(/^#version[ \t]+(\d+)/m)?.[1]||100)!==300)throw new Error("luma.gl v9 only supports GLSL 3.00 shader sources");switch(e){case"vertex":return i=uf(i,cw),i;case"fragment":return i=uf(i,lw),i;default:throw new Error(e)}}const ap=[[/^(#version[ \t]+(100|300[ \t]+es))?[ \t]*\n/,`#version 300 es
`],[/\btexture(2D|2DProj|Cube)Lod(EXT)?\(/g,"textureLod("],[/\btexture(2D|2DProj|Cube)(EXT)?\(/g,"texture("]],cw=[...ap,[sc("attribute"),"in $1"],[sc("varying"),"out $1"]],lw=[...ap,[sc("varying"),"in $1"]];function uf(i,e){for(const[t,n]of e)i=i.replace(t,n);return i}function sc(i){return new RegExp(`\\b${i}[ \\t]+(\\w+[ \\t]+\\w+(\\[\\w+\\])?;)`,"g")}function rc(i,e,t="glsl"){let n="";for(const s in i){const r=i[s];if(n+=`${t==="wgsl"?"fn":"void"} ${r.signature} {
`,r.header&&(n+=`  ${r.header}`),e[s]){const a=e[s];a.sort((c,l)=>c.order-l.order);for(const c of a)n+=`  ${c.injection}
`}r.footer&&(n+=`  ${r.footer}`),n+=`}
`}return n}function cp(i){const e={vertex:{},fragment:{}};for(const t of i){let n,s;typeof t!="string"?(n=t,s=n.hook):(n={},s=t),s=s.trim();const r=s.indexOf(":"),o=s.slice(0,r),a=s.slice(r+1),c=s.replace(/\(.+/,""),l=Object.assign(n,{signature:a});switch(o){case"vs":e.vertex[c]=l;break;case"fs":e.fragment[c]=l;break;default:throw new Error(o)}}return e}function uw(i,e){return{name:fw(i,e),language:"glsl",version:dw(i)}}function fw(i,e="unnamed"){const n=/#define[^\S\r\n]*SHADER_NAME[^\S\r\n]*([A-Za-z0-9_-]+)\s*/.exec(i);return n?n[1]:e}function dw(i){let e=100;const t=i.match(/[^\s]+/g);if(t&&t.length>=2&&t[0]==="#version"){const n=parseInt(t[1],10);Number.isFinite(n)&&(e=n)}if(e!==100&&e!==300)throw new Error(`Invalid GLSL version ${e}`);return e}const ff=[new RegExp(`@binding\\(\\s*(\\d+)\\s*\\)\\s*@group\\(\\s*(\\d+)\\s*\\)\\s*${Ge}\\s*:\\s*([^;]+);`,"g"),new RegExp(`@group\\(\\s*(\\d+)\\s*\\)\\s*@binding\\(\\s*(\\d+)\\s*\\)\\s*${Ge}\\s*:\\s*([^;]+);`,"g")];function lp(i,e=[]){const t=jr(i),n=new Map;for(const r of e)n.set(df(r.name,r.group,r.location),r.moduleName);const s=[];for(const r of ff){r.lastIndex=0;let o;for(o=r.exec(t);o;){const a=r===ff[0],c=Number(o[a?1:2]),l=Number(o[a?2:1]),u=o[3]?.trim(),f=o[4],d=o[5].trim(),h=n.get(df(f,l,c));s.push(hw({name:f,group:l,binding:c,owner:h?"module":"application",moduleName:h,accessDeclaration:u,resourceType:d})),o=r.exec(t)}}return s.sort((r,o)=>r.group!==o.group?r.group-o.group:r.binding!==o.binding?r.binding-o.binding:r.name.localeCompare(o.name))}function hw(i){const e={name:i.name,group:i.group,binding:i.binding,owner:i.owner,kind:"unknown",moduleName:i.moduleName,resourceType:i.resourceType};if(i.accessDeclaration){const t=i.accessDeclaration.split(",").map(n=>n.trim());if(t[0]==="uniform")return{...e,kind:"uniform",access:"uniform"};if(t[0]==="storage"){const n=t[1]||"read_write";return{...e,kind:n==="read"?"read-only-storage":"storage",access:n}}}return i.resourceType==="sampler"||i.resourceType==="sampler_comparison"?{...e,kind:"sampler",samplerKind:i.resourceType==="sampler_comparison"?"comparison":"filtering"}:i.resourceType.startsWith("texture_storage_")?{...e,kind:"storage-texture",access:pw(i.resourceType),viewDimension:hf(i.resourceType)}:i.resourceType.startsWith("texture_")?{...e,kind:"texture",viewDimension:hf(i.resourceType),sampleType:gw(i.resourceType),multisampled:i.resourceType.startsWith("texture_multisampled_")}:e}function df(i,e,t){return`${e}:${t}:${i}`}function hf(i){if(i.includes("cube_array"))return"cube-array";if(i.includes("2d_array"))return"2d-array";if(i.includes("cube"))return"cube";if(i.includes("3d"))return"3d";if(i.includes("2d"))return"2d";if(i.includes("1d"))return"1d"}function gw(i){if(i.startsWith("texture_depth_"))return"depth";if(i.includes("<i32>"))return"sint";if(i.includes("<u32>"))return"uint";if(i.includes("<f32>"))return"float"}function pw(i){return/,\s*([A-Za-z_][A-Za-z0-9_]*)\s*>$/.exec(i)?.[1]}const ii="([a-zA-Z_][a-zA-Z0-9_]*)",mw=/^\s*\#\s*if\s+(.+?)\s*(?:\/\/.*)?$/,yw=new RegExp(`^\\s*\\#\\s*ifdef\\s*${ii}\\s*$`),_w=new RegExp(`^\\s*\\#\\s*ifndef\\s*${ii}\\s*(?:\\/\\/.*)?$`),bw=/^\s*\#\s*else\s*(?:\/\/.*)?$/,vw=/^\s*\#\s*endif\s*$/,xw=new RegExp(`^\\s*\\#\\s*ifdef\\s*${ii}\\s*(?:\\/\\/.*)?$`),ww=/^\s*\#\s*endif\s*(?:\/\/.*)?$/;function Wn(i,e){const t=i.split(`
`),n=[],s=[];let r=!0;for(const o of t){const a=o.match(mw),c=o.match(xw)||o.match(yw),l=o.match(_w),u=o.match(bw),f=o.match(ww)||o.match(vw);if(a){const d=Pw(a[1],e?.defines||{}),h=r&&d;s.push({parentActive:r,branchTaken:d,active:h}),r=h}else if(c||l){const d=(c||l)?.[1],h=!!e?.defines?.[d],g=c?h:!h,p=r&&g;s.push({parentActive:r,branchTaken:g,active:p}),r=p}else if(u){const d=s[s.length-1];if(!d)throw new Error("Encountered #else without matching #if, #ifdef or #ifndef");d.active=d.parentActive&&!d.branchTaken,d.branchTaken=!0,r=d.active}else f?(s.pop(),r=s.length?s[s.length-1].active:!0):r&&n.push(o)}if(s.length>0)throw new Error("Unterminated conditional block in shader source");return n.join(`
`)}function Pw(i,e){const t=i.trim();if(/^[+-]?\d+(?:\.\d+)?$/.test(t))return Number(t)!==0;if(t==="true")return!0;if(t==="false")return!1;const n=t.match(new RegExp(`^!\\s*${ii}$`));if(n)return!e[n[1]];const s=t.match(new RegExp(`^${ii}$`));if(s)return!!e[s[1]];const r=t.match(new RegExp(`^defined\\s*\\(\\s*${ii}\\s*\\)$`));if(r)return e[r[1]]!==void 0;const o=t.match(new RegExp(`^!\\s*defined\\s*\\(\\s*${ii}\\s*\\)$`));if(o)return e[o[1]]===void 0;throw new Error(`Unsupported #if expression "${i}"`)}function Sw(i,e){const t=[];for(const[n,s]of Object.entries(e))Cw(i,n),t.push(`in ${_l(s)} ${n};`);return t.join(`
`)}function Ew(i,e,t){const n=Object.entries(t);if(n.length===0)return{source:i,declarations:"",initialization:""};const s=Lw(i,e),r=i.slice(s.openParenthesis+1,s.closeParenthesis),o=Tw(i,r),a=new Set(o.locations),c=[],l=[],u=[];for(const[p,m]of n){if(o.names.has(p)||Iw(i,p))throw new Error(`ShaderPlugin vertex input "${p}" conflicts with an existing WGSL shader input or variable`);const _=Rw(a);a.add(_);const v=`_luma_${p}`;c.push(`@location(${_}) ${v}: ${m}`),l.push(`var<private> ${p}: ${m};`),u.push(`${p} = ${v};`)}const f=r.trim()?`,
  `:`
  `,d=r.trim()?"":`
`,h=`${r}${f}${c.join(`,
  `)}${d}`;return{source:i.slice(0,s.openParenthesis+1)+h+i.slice(s.closeParenthesis),declarations:l.join(`
`),initialization:u.join(`
`)}}function _l(i){const{primitiveType:e,components:t}=sn.getAttributeShaderTypeInfo(i),n=e==="i32"?"int":e==="u32"?"uint":"float";return t===1?n:`${n==="int"?"i":n==="uint"?"u":""}vec${t}`}function Cw(i,e){const t=Jr(e);if(new RegExp(`\\b(?:in|attribute)\\s+(?:(?:lowp|mediump|highp)\\s+)?[A-Za-z_][A-Za-z0-9_]*\\s+${t}\\s*(?:\\[|;)`).test(i))throw new Error(`ShaderPlugin vertex input "${e}" conflicts with an existing GLSL input`)}function Lw(i,e){const n=new RegExp(`\\bfn\\s+${Jr(e)}\\s*\\(`,"g").exec(i);if(!n)throw new Error(`ShaderPlugin vertex inputs require WGSL vertex entry point "${e}"`);const s=i.indexOf("(",n.index),r=up(i,s,"(",")");if(r<0)throw new Error(`Unable to parse WGSL vertex entry point "${e}" parameters`);return{openParenthesis:s,closeParenthesis:r}}function Tw(i,e){const t=gf(e),n=new Set(pf(e)),s=Aw(e);for(const r of s){const o=Mw(i,r);if(o!==null){t.push(...gf(o));for(const a of pf(o))n.add(a)}}return{locations:t,names:n}}function gf(i){const e=[],t=/@location\s*\(\s*(\d+)\s*\)/g;let n=t.exec(i);for(;n;)e.push(Number(n[1])),n=t.exec(i);return e}function pf(i){const e=[],t=/(?:^|,)\s*(?:@[A-Za-z_][\w]*(?:\([^)]*\))?\s*)*([A-Za-z_][\w]*)\s*:/gm;let n=t.exec(i);for(;n;)e.push(n[1]),n=t.exec(i);return e}function Aw(i){const e=[],t=/:\s*([A-Za-z_][\w]*)\b/g;let n=t.exec(i);for(;n;)e.push(n[1]),n=t.exec(i);return e}function Mw(i,e){const n=new RegExp(`\\bstruct\\s+${Jr(e)}\\s*\\{`,"g").exec(i);if(!n)return null;const s=i.indexOf("{",n.index),r=up(i,s,"{","}");return r<0?null:i.slice(s+1,r)}function Iw(i,e){const t=Jr(e),n=new RegExp(`\\b(?:var(?:<[^>]+>)?|let|const)\\s+${t}\\b`,"g");let s=n.exec(i);for(;s;){if(Ow(i,s.index)===0)return!0;s=n.exec(i)}return!1}function Rw(i){let e=0;for(;i.has(e);)e++;return e}function up(i,e,t,n){let s=0,r=0,o=!1;for(let a=e;a<i.length;a++){const c=i[a],l=i[a+1];if(o){c===`
`&&(o=!1);continue}if(r>0){c==="/"&&l==="*"?(r++,a++):c==="*"&&l==="/"&&(r--,a++);continue}if(c==="/"&&l==="/"){o=!0,a++;continue}if(c==="/"&&l==="*"){r=1,a++;continue}if(c===t&&s++,c===n&&--s===0)return a}return-1}function Ow(i,e){let t=0,n=0,s=!1;for(let r=0;r<e;r++){const o=i[r],a=i[r+1];if(s){o===`
`&&(s=!1);continue}if(n>0){o==="/"&&a==="*"?(n++,r++):o==="*"&&a==="/"&&(n--,r++);continue}o==="/"&&a==="/"?(s=!0,r++):o==="/"&&a==="*"?(n=1,r++):o==="{"?t++:o==="}"&&t--}return t}function Jr(i){return i.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")}function kw(i,e,t){const n=[],s=[];for(const[r,o]of Object.entries(t)){qw(i,r);const a=o.interpolation==="flat"?"flat ":"",c=e==="vertex"?"out":"in";n.push(`${a}${c} ${_l(o.type)} ${r};`),e==="vertex"&&s.push(`${r} = ${Hw(o.type)};`)}return{declarations:n.join(`
`),initialization:s.join(`
`)}}function Bw(i,e,t,n){const s=Object.entries(n);if(s.length===0)return{source:i,declarations:"",vertexInitialization:"",fragmentInitialization:""};let r=i,o=vs(r,e,"vertex");const a=Dw(r,o);let c=vs(r,t,"fragment");const l=Fw(r,c),u=Go(r,a),f=Go(r,l.type),d=new Set([...xs(o.parameters),...xs(u.body),...xs(c.parameters),...xs(f.body)]),h=new Set([...mf(u.body),...mf(f.body)]),g=[],p=[],m=[],_=[];for(const[w,C]of s){if(d.has(w)||jw(r,w))throw new Error(`ShaderPlugin varying "${w}" conflicts with existing WGSL stage I/O or a module variable`);const B=Ww(h);h.add(B);const F=C.interpolation==="flat"?" @interpolate(flat)":"";g.push(`  @location(${B})${F} ${w}: ${C.type},`),p.push(`var<private> ${w}: ${C.type};`),m.push(`${w} = ${Yw(C.type)};`),_.push(`${w} = ${l.name}.${w};`)}zw(r,a,o.openBrace,o.closeBrace),r=Nw(r,a,o,s.map(([w])=>w)),o=vs(r,e,"vertex"),r=Uw(r,o,s.map(([w])=>w));const b=(a===l.type?[a]:[a,l.type]).map(w=>Go(r,w).closeBrace).sort((w,C)=>C-w);for(const w of b)r=r.slice(0,w)+`${g.join(`
`)}
`+r.slice(w);if(c=vs(r,t,"fragment"),!new RegExp(`\\b${yi(l.name)}\\s*:`).test(c.parameters))throw new Error(`Unable to preserve WGSL fragment input "${l.name}"`);return{source:r,declarations:p.join(`
`),vertexInitialization:m.join(`
`),fragmentInitialization:_.join(`
`)}}function vs(i,e,t){const s=new RegExp(`\\bfn\\s+${yi(e)}\\s*\\(`,"g").exec(i);if(!s)throw new Error(`ShaderPlugin varyings require WGSL ${t} entry point "${e}"`);const r=i.indexOf("(",s.index),o=wr(i,r,"(",")"),a=i.indexOf("{",o),c=wr(i,a,"{","}");if(o<0||a<0||c<0)throw new Error(`Unable to parse WGSL ${t} entry point "${e}"`);return{openParenthesis:r,closeParenthesis:o,openBrace:a,closeBrace:c,parameters:i.slice(r+1,o)}}function Dw(i,e){const t=i.slice(e.closeParenthesis+1,e.openBrace),n=/->\s*([A-Za-z_][\w]*)\s*$/.exec(t.trim());if(!n||bl(i,n[1])===null)throw new Error("ShaderPlugin varyings require the WGSL vertex entry point to return a named struct");return n[1]}function Fw(i,e){const t=[];for(const n of Vw(e.parameters,",")){const s=/(?:@[A-Za-z_][\w]*(?:\([^)]*\))?\s*)*([A-Za-z_][\w]*)\s*:\s*([A-Za-z_][\w]*)\s*$/.exec(n.trim());s&&bl(i,s[2])&&t.push({name:s[1],type:s[2]})}if(t.length!==1)throw new Error(`ShaderPlugin varyings require exactly one named WGSL fragment input struct; found ${t.length}`);return t[0]}function Go(i,e){const t=bl(i,e);if(!t)throw new Error(`Unable to find WGSL stage I/O struct "${e}"`);return t}function bl(i,e){const n=new RegExp(`\\bstruct\\s+${yi(e)}\\s*\\{`,"g").exec(i);if(!n)return null;const s=i.indexOf("{",n.index),r=wr(i,s,"{","}");return r<0?null:{openBrace:s,closeBrace:r,body:i.slice(s+1,r)}}function zw(i,e,t,n){const s=new RegExp(`\\b${yi(e)}\\s*\\(`,"g");let r=s.exec(i);for(;r;){if(r.index<t||r.index>n)throw new Error(`ShaderPlugin varying output struct "${e}" is constructed outside the selected vertex entry point`);r=s.exec(i)}}function Nw(i,e,t,n){const s=new RegExp(`\\b${yi(e)}\\s*\\(`,"g"),r=[];let o=s.exec(i);for(;o;){if(o.index>t.openBrace&&o.index<t.closeBrace){const a=i.indexOf("(",o.index),c=wr(i,a,"(",")");if(c<0||c>t.closeBrace)throw new Error(`Unable to parse WGSL output constructor "${e}"`);r.push({openParenthesis:a,closeParenthesis:c})}o=s.exec(i)}for(const a of r.sort((c,l)=>l.closeParenthesis-c.closeParenthesis)){const l=i.slice(a.openParenthesis+1,a.closeParenthesis).trim()?", ":"";i=i.slice(0,a.closeParenthesis)+l+n.join(", ")+i.slice(a.closeParenthesis)}return i}function Uw(i,e,t){const n=$w(i,e.openBrace+1,e.closeBrace);for(let s=n.length-1;s>=0;s--){const r=n[s],o=i.slice(r.expressionStart,r.semicolon).trim();if(!o)throw new Error("ShaderPlugin varying vertex entry point cannot use an empty return");const a=`_luma_vertexOutput${s}`,c=t.map(u=>`${a}.${u} = ${u};`).join(`
`),l=`{
var ${a} = ${o};
${c}
return ${a};
}`;i=i.slice(0,r.start)+l+i.slice(r.semicolon+1)}return i}function $w(i,e,t){const n=[];let s=e;for(;s<t;)if(s=vl(i,s,t),i.slice(s,s+6)==="return"&&!/[A-Za-z0-9_]/.test(i[s+6]||"")){const r=s+6,o=Gw(i,r,t);if(o<0)throw new Error("Unable to parse WGSL return statement in selected vertex entry point");n.push({start:s,expressionStart:r,semicolon:o}),s=o+1}else s++;return n}function Gw(i,e,t){let n=0,s=0;for(let r=e;r<t;r++){const o=vl(i,r,t);if(o!==r){r=o-1;continue}const a=i[r];if(a==="("&&n++,a===")"&&n--,a==="["&&s++,a==="]"&&s--,a===";"&&n===0&&s===0)return r}return-1}function vl(i,e,t){let n=e;if(i[n]==="/"&&i[n+1]==="/"){const s=i.indexOf(`
`,n+2);return s<0||s>t?t:s+1}if(i[n]==="/"&&i[n+1]==="*"){let s=1;for(n+=2;n<t&&s>0;)i[n]==="/"&&i[n+1]==="*"?(s++,n+=2):i[n]==="*"&&i[n+1]==="/"?(s--,n+=2):n++}return n}function Vw(i,e){const t=[];let n=0,s=0,r=0;for(let o=0;o<i.length;o++){const a=i[o];a==="("&&s++,a===")"&&s--,a==="<"&&r++,a===">"&&r--,a===e&&s===0&&r===0&&(t.push(i.slice(n,o)),n=o+1)}return t.push(i.slice(n)),t}function mf(i){const e=[],t=/@location\s*\(\s*(\d+)\s*\)/g;let n=t.exec(i);for(;n;)e.push(Number(n[1])),n=t.exec(i);return e}function xs(i){const e=[],t=/(?:^|,)\s*(?:@[A-Za-z_][\w]*(?:\([^)]*\))?\s*)*([A-Za-z_][\w]*)\s*:/gm;let n=t.exec(i);for(;n;)e.push(n[1]),n=t.exec(i);return e}function jw(i,e){const t=new RegExp(`\\b(?:var(?:<[^>]+>)?|let|const)\\s+${yi(e)}\\b`,"g");let n=t.exec(i);for(;n;){if(Zw(i,n.index)===0)return!0;n=t.exec(i)}return!1}function Ww(i){let e=0;for(;i.has(e);)e++;return e}function Hw(i){const{primitiveType:e,components:t}=sn.getAttributeShaderTypeInfo(i),n=e==="u32"?"0u":e==="i32"?"0":"0.0";return t===1?n:`${_l(i)}(${n})`}function Yw(i){const{primitiveType:e,components:t}=sn.getAttributeShaderTypeInfo(i),n=`${e}(0)`;return t===1?n:`${i}(${n})`}function qw(i,e){if(new RegExp(`\\b(?:flat\\s+|smooth\\s+)?(?:in|out|varying)\\s+(?:(?:lowp|mediump|highp)\\s+)?[A-Za-z_][A-Za-z0-9_]*\\s+${yi(e)}\\s*(?:\\[|;)`).test(i))throw new Error(`ShaderPlugin varying "${e}" conflicts with existing GLSL stage I/O`)}function wr(i,e,t,n){let s=0,r=0,o=!1;for(let a=e;a<i.length;a++){const c=i[a],l=i[a+1];if(o){c===`
`&&(o=!1);continue}if(r>0){c==="/"&&l==="*"?(r++,a++):c==="*"&&l==="/"&&(r--,a++);continue}if(c==="/"&&l==="/"){o=!0,a++;continue}if(c==="/"&&l==="*"){r=1,a++;continue}if(c===t&&s++,c===n&&--s===0)return a}return-1}function Zw(i,e){let t=0;for(let n=0;n<e;n++){const s=vl(i,n,e);if(s!==n){n=s-1;continue}i[n]==="{"&&t++,i[n]==="}"&&t--}return t}function yi(i){return i.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")}const xl=`

${Us}
`,Hn=100,Xw=`precision highp float;
`;function Kw(i){const e=_r(i.modules||[]),{source:t,bindingAssignments:n}=Jw(i.platformInfo,{...i,source:i.source,stage:"vertex",modules:e});return{source:t,getUniforms:fp(e),bindingAssignments:n,bindingTable:lp(t,n),shaderLayout:Bg(t,{vertexEntryPoint:i.vertexEntryPoint,scanVertexAttributes:i.scanVertexAttributes})}}function Qw(i){const{vs:e,fs:t}=i,n=_r(i.modules||[]);return{vs:yf(i.platformInfo,{...i,source:e,stage:"vertex",modules:n}),fs:yf(i.platformInfo,{...i,source:t,stage:"fragment",modules:n}),getUniforms:fp(n)}}function Jw(i,e){const{source:t,stage:n,modules:s,defines:r={},hookFunctions:o=[],inject:a={},pluginInjections:c={},pluginVertexInputs:l={},pluginVaryings:u={},vertexEntryPoint:f="vertexMain",fragmentEntryPoint:d="fragmentMain",log:h}=e;tn(typeof t=="string","shader source must be a string");const g=Wn(t,{defines:r}),p=Ew(g,f,l),m=Bw(p.source,f,d,u),_=m.source;let v="";const b=cp(o),x={},w={},C={};dp(c,x,w,C);for(const G in a){const z=typeof a[G]=="string"?{injection:a[G],order:0}:a[G],V=/^(v|f)s:(#)?([\w-]+)$/.exec(G);if(V){const J=V[2],y=V[3];J?y==="decl"?w[G]=[z]:C[G]=[z]:x[G]=[z]}else C[G]=[z]}eP(p.declarations,p.initialization,w,C),tP(m,w,C);const B=s,F=aP(_),D=oP(F.source),k=fP(B,e._bindingRegistry,D,r),W=[];for(const G of B){h&&$g(G,_,h);const z=Wn(hp(G,"wgsl",h),{defines:r}),V=cP(z,G,{usedBindingsByGroup:D,bindingRegistry:e._bindingRegistry,reservedBindingKeysByGroup:k});W.push(...V.bindingAssignments);const J=V.source;v+=J;const y=iP(G);for(const S in y){const P=/^(v|f)s:#([\w-]+)$/.exec(S);if(P){const L=P[2]==="decl"?w:C;L[S]=L[S]||[],L[S].push(y[S])}else x[S]=x[S]||[],x[S].push(y[S])}}return v+=xl,v=mr(v,n,nP(w),!1,"wgsl",{vertex:f,fragment:d}),v+=sP(b,x),v+=yP(W),v+=F.source,v=mr(v,n,C,!1,"wgsl",{vertex:f,fragment:d}),mP(v),{source:v,bindingAssignments:W}}function yf(i,e){const{source:t,stage:n,language:s="glsl",modules:r,defines:o={},hookFunctions:a=[],inject:c={},pluginInjections:l={},pluginVertexInputs:u={},pluginVaryings:f={},prologue:d=!0,log:h}=e;tn(typeof t=="string","shader source must be a string");const g=s==="glsl"?uw(t).version:-1,p=i.shaderLanguageVersion,m=g===100?"#version 100":"#version 300 es",v=t.split(`
`).slice(1).join(`
`),b={};r.forEach(k=>{Object.assign(b,k.defines)}),Object.assign(b,o);let x="";switch(s){case"wgsl":break;case"glsl":x=d?`${m}

// ----- PROLOGUE -------------------------
${`#define SHADER_TYPE_${n.toUpperCase()}`}

${ow(i)}
${n==="fragment"?Xw:""}

// ----- APPLICATION DEFINES -------------------------

${rP(b)}

`:`${m}
`;break}const w=cp(a),C={},B={},F={};dp(l,C,B,F);for(const k in c){const W=typeof c[k]=="string"?{injection:c[k],order:0}:c[k],G=/^(v|f)s:(#)?([\w-]+)$/.exec(k);if(G){const z=G[2],V=G[3];z?V==="decl"?B[k]=[W]:F[k]=[W]:C[k]=[W]}else F[k]=[W]}if(n==="vertex"){const k=Sw(v,u);k&&(B["vs:#decl"]=B["vs:#decl"]||[],B["vs:#decl"].push({injection:k,order:Number.MIN_SAFE_INTEGER}))}const D=kw(v,n,f);if(D.declarations){const k=n==="vertex"?"vs:#decl":"fs:#decl";B[k]=B[k]||[],B[k].push({injection:D.declarations,order:Number.MIN_SAFE_INTEGER})}D.initialization&&(F["vs:#main-start"]=F["vs:#main-start"]||[],F["vs:#main-start"].push({injection:D.initialization,order:Number.MIN_SAFE_INTEGER}));for(const k of r){h&&$g(k,v,h);const W=hp(k,n,h);x+=W;const G=k.instance?.normalizedInjections[n]||{};for(const z in G){const V=/^(v|f)s:#([\w-]+)$/.exec(z);if(V){const y=V[2]==="decl"?B:F;y[z]=y[z]||[],y[z].push(G[z])}else C[z]=C[z]||[],C[z].push(G[z])}}return x+="// ----- MAIN SHADER SOURCE -------------------------",x+=xl,x=mr(x,n,B),x+=rc(w[n],C),x+=v,x=mr(x,n,F),s==="glsl"&&g!==p&&(x=aw(x,n)),s==="glsl"&&Kx(x,n,h),x.trim()}function fp(i){return function(t){const n={};for(const s of i){const r=s.getUniforms?.(t,n);Object.assign(n,r)}return n}}function dp(i,e,t,n){for(const s in i){const r=/^(v|f)s:(#)?([\w-]+)$/.exec(s);if(r){const o=r[2],a=r[3],c=o?a==="decl"?t:n:e;c[s]=c[s]||[],c[s].push(...i[s])}else n[s]=n[s]||[],n[s].push(...i[s])}}function eP(i,e,t,n){i&&(t["vs:#decl"]=t["vs:#decl"]||[],t["vs:#decl"].push({injection:i,order:Number.MIN_SAFE_INTEGER})),e&&(n["vs:#main-start"]=n["vs:#main-start"]||[],n["vs:#main-start"].push({injection:e,order:Number.MIN_SAFE_INTEGER}))}function tP(i,e,t){i.declarations&&(e["vs:#decl"]=e["vs:#decl"]||[],e["vs:#decl"].push({injection:i.declarations,order:Number.MIN_SAFE_INTEGER})),i.vertexInitialization&&(t["vs:#main-start"]=t["vs:#main-start"]||[],t["vs:#main-start"].push({injection:i.vertexInitialization,order:Number.MIN_SAFE_INTEGER})),i.fragmentInitialization&&(t["fs:#main-start"]=t["fs:#main-start"]||[],t["fs:#main-start"].push({injection:i.fragmentInitialization,order:Number.MIN_SAFE_INTEGER}))}function iP(i){return{...i.instance?.normalizedInjections.vertex||{},...i.instance?.normalizedInjections.fragment||{}}}function nP(i){const e=[...i["vs:#decl"]||[],...i["fs:#decl"]||[]];return e.length?{"vs:#decl":e}:{}}function sP(i,e){return rc(i.vertex,e,"wgsl")+rc(i.fragment,e,"wgsl")}function rP(i={}){let e="";for(const t in i){const n=i[t];(n||Number.isFinite(n))&&(e+=`#define ${t.toUpperCase()} ${i[t]}
`)}return e}function hp(i,e,t){let n;switch(e){case"vertex":n=i.vs||"";break;case"fragment":n=i.fs||"";break;case"wgsl":n=i.source||"";break;default:tn(!1)}if(!i.name)throw new Error("Shader module must have a name");Xx(i,e,{log:t});const s=i.name.toUpperCase().replace(/[^0-9a-z]/gi,"_");let r=`// ----- MODULE ${i.name} ---------------

`;return e!=="wgsl"&&(r+=`#define MODULE_${s}
`),r+=`${n}
`,r}function oP(i){const e=new Map;for(const t of en(i,bv)){const n=Number(t.bindingToken),s=Number(t.groupToken);wl(s,n,t.name),Hi(e,s,n,`application binding "${t.name}"`)}return e}function aP(i){const e=en(i,qa),t=new Map;for(const r of e){if(r.bindingToken==="auto")continue;const o=Number(r.bindingToken),a=Number(r.groupToken);wl(a,o,r.name),Hi(t,a,o,`application binding "${r.name}"`)}const n={sawSupportedBindingDeclaration:e.length>0},s=Og(i,qa,r=>uP(r,t,n));if(kg(i)&&!n.sawSupportedBindingDeclaration)throw new Error('Unsupported @binding(auto) declaration form in application WGSL. Use adjacent "@group(N)" and "@binding(auto)" decorators followed by a bindable "var" declaration.');return{source:s}}function cP(i,e,t){const n=[],r={sawSupportedBindingDeclaration:en(i,$n).length>0,nextHintedBindingLocation:typeof e.firstBindingSlot=="number"?e.firstBindingSlot:null},o=Og(i,$n,a=>lP(a,{module:e,context:t,bindingAssignments:n,relocationState:r}));if(kg(i)&&!r.sawSupportedBindingDeclaration)throw new Error(`Unsupported @binding(auto) declaration form in module "${e.name}". Use adjacent "@group(N)" and "@binding(auto)" decorators followed by a bindable "var" declaration.`);return{source:o,bindingAssignments:n}}function lP(i,e){const{module:t,context:n,bindingAssignments:s,relocationState:r}=e,{match:o,bindingToken:a,groupToken:c,name:l}=i,u=Number(c);if(a==="auto"){const d=gp(u,t.name,l),h=n.bindingRegistry?.get(d),g=h!==void 0?h:gP(u,n.usedBindingsByGroup,t.name,r.nextHintedBindingLocation??void 0,n.bindingRegistry);return _f(t.name,u,g,l),h!==void 0&&dP(n.reservedBindingKeysByGroup,u,g,d)?(s.push({moduleName:t.name,name:l,group:u,location:g}),o.replace(/@binding\(\s*auto\s*\)/,`@binding(${g})`)):(Hi(n.usedBindingsByGroup,u,g,`module "${t.name}" binding "${l}"`),n.bindingRegistry?.set(d,g),s.push({moduleName:t.name,name:l,group:u,location:g}),r.nextHintedBindingLocation!==null&&h===void 0&&(r.nextHintedBindingLocation=g+1),o.replace(/@binding\(\s*auto\s*\)/,`@binding(${g})`))}const f=Number(a);return _f(t.name,u,f,l),Hi(n.usedBindingsByGroup,u,f,`module "${t.name}" binding "${l}"`),s.push({moduleName:t.name,name:l,group:u,location:f}),o}function uP(i,e,t){const{match:n,bindingToken:s,groupToken:r,name:o}=i,a=Number(r);if(s==="auto"){const c=pP(a,e);return wl(a,c,o),Hi(e,a,c,`application binding "${o}"`),n.replace(/@binding\(\s*auto\s*\)/,`@binding(${c})`)}return t.sawSupportedBindingDeclaration=!0,n}function fP(i,e,t,n){const s=new Map;if(!e)return s;for(const r of i)for(const o of hP(r,n)){const a=gp(o.group,r.name,o.name),c=e.get(a);if(c!==void 0){const l=s.get(o.group)||new Map,u=l.get(c);if(u&&u!==a)throw new Error(`Duplicate WGSL binding reservation for modules "${u}" and "${a}": group ${o.group}, binding ${c}.`);Hi(t,o.group,c,`registered module binding "${a}"`),l.set(c,a),s.set(o.group,l)}}return s}function dP(i,e,t,n){const s=i.get(e);if(!s)return!1;const r=s.get(t);if(!r)return!1;if(r!==n)throw new Error(`Registered module binding "${n}" collided with "${r}": group ${e}, binding ${t}.`);return!0}function hP(i,e){const t=[],n=Wn(i.source||"",{defines:e});for(const s of en(n,$n))t.push({name:s.name,group:Number(s.groupToken)});return t}function wl(i,e,t){if(i===0&&e>=Hn)throw new Error(`Application binding "${t}" in group 0 uses reserved binding ${e}. Application-owned explicit group-0 bindings must stay below ${Hn}.`)}function _f(i,e,t,n){if(e===0&&t<Hn)throw new Error(`Module "${i}" binding "${n}" in group 0 uses reserved application binding ${t}. Module-owned explicit group-0 bindings must be ${Hn} or higher.`)}function Hi(i,e,t,n){const s=i.get(e)||new Set;if(s.has(t))throw new Error(`Duplicate WGSL binding assignment for ${n}: group ${e}, binding ${t}.`);s.add(t),i.set(e,s)}function gP(i,e,t,n,s){const r=e.get(i)||new Set,o=new Set,a=`${i}:`,c=`${a}${t}:`;for(const[u,f]of s||[])u.startsWith(c)&&o.add(f);let l=n??(i===0?Hn:r.size>0?Math.max(...r)+1:0);for(;r.has(l)||o.has(l);)l++;for(const[u,f]of s||[])f===l&&u.startsWith(a)&&s?.delete(u);return l}function pP(i,e){const t=e.get(i)||new Set;let n=0;for(;t.has(n);)n++;return n}function mP(i){const e=xv(i,$n);if(!e)return;const t=_P(i,e.index);throw t?new Error(`Unresolved @binding(auto) for module "${t}" binding "${e.name}" remained in assembled WGSL source.`):bP(i,e.index)?new Error(`Unresolved @binding(auto) for application binding "${e.name}" remained in assembled WGSL source.`):new Error(`Unresolved @binding(auto) remained in assembled WGSL source near "${vP(e.match)}".`)}function yP(i){if(i.length===0)return"";let e=`// ----- MODULE WGSL BINDING ASSIGNMENTS ---------------
`;for(const t of i)e+=`// ${t.moduleName}.${t.name} -> @group(${t.group}) @binding(${t.location})
`;return e+=`
`,e}function gp(i,e,t){return`${i}:${e}:${t}`}function _P(i,e){const t=/^\/\/ ----- MODULE ([^\n]+) ---------------$/gm;let n,s;for(s=t.exec(i);s&&s.index<=e;)n=s[1],s=t.exec(i);return n}function bP(i,e){const t=i.indexOf(xl);return t>=0?e>t:!0}function vP(i){return i.replace(/\s+/g," ").trim()}class Fe{static defaultShaderAssemblers={};_hookFunctions=[];_defaultModules=[];static getDefaultShaderAssembler(e){return tn(e==="glsl"||e==="wgsl"),e==="wgsl"?(Fe.defaultShaderAssemblers.wgsl=Fe.defaultShaderAssemblers.wgsl||new Yi,Fe.defaultShaderAssemblers.wgsl):(Fe.defaultShaderAssemblers.glsl=Fe.defaultShaderAssemblers.glsl||new xP,Fe.defaultShaderAssemblers.glsl)}addDefaultModule(e){this._defaultModules.find(t=>t.name===(typeof e=="string"?e:e.name))||this._defaultModules.push(e)}removeDefaultModule(e){const t=typeof e=="string"?e:e.name;this._defaultModules=this._defaultModules.filter(n=>n.name!==t)}addShaderHook(e,t){t&&(e=Object.assign(t,{hook:e})),this._hookFunctions.push(e)}_getModuleList(e=[]){const t=new Array(this._defaultModules.length+e.length),n={};let s=0;for(let r=0,o=this._defaultModules.length;r<o;++r){const a=this._defaultModules[r],c=a.name;t[s++]=a,n[c]=!0}for(let r=0,o=e.length;r<o;++r){const a=e[r],c=a.name;n[c]||(t[s++]=a,n[c]=!0)}return t.length=s,yr(t),t}}class xP extends Fe{shaderLanguage="glsl";assembleGLSLShaderPair(e){const t=this._getModuleList(e.modules),n=this._hookFunctions;return{...Qw({...e,vs:e.vs,fs:e.fs,modules:t,hookFunctions:n}),modules:t}}}class Yi extends Fe{shaderLanguage="wgsl";_wgslBindingRegistry=new Map;assembleWGSLShader(e){const t=this._getModuleList(e.modules),n=this._hookFunctions,s=Yi.getShaderPreprocessorDefines(e,t),r=e.platformInfo.shaderLanguage==="wgsl"&&e.source?Wn(e.source,{defines:s}):e.source,{source:o,getUniforms:a,bindingAssignments:c}=Kw({...e,source:r,defines:s,_bindingRegistry:this._wgslBindingRegistry,modules:t,hookFunctions:n}),l=e.platformInfo.shaderLanguage==="wgsl"?Wn(o,{defines:s}):o;return{source:l,getUniforms:a,modules:t,bindingAssignments:c,bindingTable:lp(l,c),shaderLayout:Bg(l,{vertexEntryPoint:e.vertexEntryPoint,scanVertexAttributes:e.scanVertexAttributes})}}static getShaderPreprocessorDefines(e,t){return{...Yi.getPlatformPreprocessorDefines(e.platformInfo),...t.reduce((n,s)=>(Object.assign(n,s.defines),n),{}),...e.defines}}static getPlatformPreprocessorDefines(e){const t=e.limits||{};return{LUMA_SUPPORTS_VERTEX_STORAGE_BUFFERS:e.type==="webgpu"&&(t.maxStorageBuffersInVertexStage||0)>0,LUMA_FP32_TAN_PRECISION_WORKAROUND:e.type==="webgpu"&&e.gpu.toLowerCase()!=="nvidia"&&e.gpu.toLowerCase()!=="amd",LUMA_FP64_INTEGER_ARITHMETIC:e.type==="webgpu"&&e.gpu.toLowerCase()==="apple"}}}const wP=`out vec4 transform_output;
void main() {
  transform_output = vec4(0);
}`,PP=`#version 300 es
${wP}`;function SP(i){const{input:e,inputChannels:t,output:n}={};if(!e)return PP;if(!t)throw new Error("inputChannels");const s=EP(t),r=CP(e,t);return`#version 300 es
in ${s} ${e};
out vec4 ${n};
void main() {
  ${n} = ${r};
}`}function EP(i){switch(i){case 1:return"float";case 2:return"vec2";case 3:return"vec3";case 4:return"vec4";default:throw new Error(`invalid channels: ${i}`)}}function CP(i,e){switch(e){case 1:return`vec4(${i}, 0.0, 0.0, 1.0)`;case 2:return`vec4(${i}, 0.0, 1.0)`;case 3:return`vec4(${i}, 1.0)`;case 4:return i;default:throw new Error(`invalid channels: ${e}`)}}const LP={EPSILON:1e-12,debug:!1,precision:4,printTypes:!1,printDegrees:!1,printRowMajor:!0,_cartographicRadians:!1};globalThis.mathgl=globalThis.mathgl||{config:{...LP}};const Oe=globalThis.mathgl.config;function TP(i,{precision:e=Oe.precision}={}){return i=AP(i),`${parseFloat(i.toPrecision(e))}`}function li(i){return Array.isArray(i)||ArrayBuffer.isView(i)&&!(i instanceof DataView)}function me(i,e,t){return IP(i,n=>Math.max(e,Math.min(t,n)))}function Ut(i,e,t){return li(i)?i.map((n,s)=>Ut(n,e[s],t)):t*e+(1-t)*i}function Ni(i,e,t){const n=Oe.EPSILON;try{if(i===e)return!0;if(li(i)&&li(e)){if(i.length!==e.length)return!1;for(let s=0;s<i.length;++s)if(!Ni(i[s],e[s]))return!1;return!0}return i&&i.equals?i.equals(e):e&&e.equals?e.equals(i):typeof i=="number"&&typeof e=="number"?Math.abs(i-e)<=Oe.EPSILON*Math.max(1,Math.abs(i),Math.abs(e)):!1}finally{Oe.EPSILON=n}}function AP(i){return Math.round(i/Oe.EPSILON)*Oe.EPSILON}function MP(i){return i.clone?i.clone():new Array(i.length)}function IP(i,e,t){if(li(i)){const n=i;t=t||MP(n);for(let s=0;s<t.length&&s<n.length;++s){const r=typeof i=="number"?i:i[s];t[s]=e(r,s,t)}return t}return e(i)}class Pl extends Array{clone(){return new this.constructor().copy(this)}fromArray(e,t=0){for(let n=0;n<this.ELEMENTS;++n)this[n]=e[n+t];return this.check()}toArray(e=[],t=0){for(let n=0;n<this.ELEMENTS;++n)e[t+n]=this[n];return e}toObject(e){return e}from(e){return Array.isArray(e)?this.copy(e):this.fromObject(e)}to(e){return e===this?this:li(e)?this.toArray(e):this.toObject(e)}toTarget(e){return e?this.to(e):this}toFloat32Array(){return new Float32Array(this)}toString(){return this.formatString(Oe)}formatString(e){let t="";for(let n=0;n<this.ELEMENTS;++n)t+=(n>0?", ":"")+TP(this[n],e);return`${e.printTypes?this.constructor.name:""}[${t}]`}equals(e){if(!e||this.length!==e.length)return!1;for(let t=0;t<this.ELEMENTS;++t)if(!Ni(this[t],e[t]))return!1;return!0}exactEquals(e){if(!e||this.length!==e.length)return!1;for(let t=0;t<this.ELEMENTS;++t)if(this[t]!==e[t])return!1;return!0}negate(){for(let e=0;e<this.ELEMENTS;++e)this[e]=-this[e];return this.check()}lerp(e,t,n){if(n===void 0)return this.lerp(this,e,t);for(let s=0;s<this.ELEMENTS;++s){const r=e[s],o=typeof t=="number"?t:t[s];this[s]=r+n*(o-r)}return this.check()}min(e){for(let t=0;t<this.ELEMENTS;++t)this[t]=Math.min(e[t],this[t]);return this.check()}max(e){for(let t=0;t<this.ELEMENTS;++t)this[t]=Math.max(e[t],this[t]);return this.check()}clamp(e,t){for(let n=0;n<this.ELEMENTS;++n)this[n]=Math.min(Math.max(this[n],e[n]),t[n]);return this.check()}add(...e){for(const t of e)for(let n=0;n<this.ELEMENTS;++n)this[n]+=t[n];return this.check()}subtract(...e){for(const t of e)for(let n=0;n<this.ELEMENTS;++n)this[n]-=t[n];return this.check()}scale(e){if(typeof e=="number")for(let t=0;t<this.ELEMENTS;++t)this[t]*=e;else for(let t=0;t<this.ELEMENTS&&t<e.length;++t)this[t]*=e[t];return this.check()}multiplyByScalar(e){for(let t=0;t<this.ELEMENTS;++t)this[t]*=e;return this.check()}check(){if(Oe.debug&&!this.validate())throw new Error(`math.gl: ${this.constructor.name} some fields set to invalid numbers'`);return this}validate(){let e=this.length===this.ELEMENTS;for(let t=0;t<this.ELEMENTS;++t)e=e&&Number.isFinite(this[t]);return e}sub(e){return this.subtract(e)}setScalar(e){for(let t=0;t<this.ELEMENTS;++t)this[t]=e;return this.check()}addScalar(e){for(let t=0;t<this.ELEMENTS;++t)this[t]+=e;return this.check()}subScalar(e){return this.addScalar(-e)}multiplyScalar(e){for(let t=0;t<this.ELEMENTS;++t)this[t]*=e;return this.check()}divideScalar(e){return this.multiplyByScalar(1/e)}clampScalar(e,t){for(let n=0;n<this.ELEMENTS;++n)this[n]=Math.min(Math.max(this[n],e),t);return this.check()}get elements(){return this}}function RP(i,e){if(i.length!==e)return!1;for(let t=0;t<i.length;++t)if(!Number.isFinite(i[t]))return!1;return!0}function fe(i){if(!Number.isFinite(i))throw new Error(`Invalid number ${JSON.stringify(i)}`);return i}function $s(i,e,t=""){if(Oe.debug&&!RP(i,e))throw new Error(`math.gl: ${t} some fields set to invalid numbers'`);return i}function bf(i,e){if(!i)throw new Error(`math.gl assertion ${e}`)}class pp extends Pl{get x(){return this[0]}set x(e){this[0]=fe(e)}get y(){return this[1]}set y(e){this[1]=fe(e)}len(){return Math.sqrt(this.lengthSquared())}magnitude(){return this.len()}lengthSquared(){let e=0;for(let t=0;t<this.ELEMENTS;++t)e+=this[t]*this[t];return e}magnitudeSquared(){return this.lengthSquared()}distance(e){return Math.sqrt(this.distanceSquared(e))}distanceSquared(e){let t=0;for(let n=0;n<this.ELEMENTS;++n){const s=this[n]-e[n];t+=s*s}return fe(t)}dot(e){let t=0;for(let n=0;n<this.ELEMENTS;++n)t+=this[n]*e[n];return fe(t)}normalize(){const e=this.magnitude();if(e!==0)for(let t=0;t<this.ELEMENTS;++t)this[t]/=e;return this.check()}multiply(...e){for(const t of e)for(let n=0;n<this.ELEMENTS;++n)this[n]*=t[n];return this.check()}divide(...e){for(const t of e)for(let n=0;n<this.ELEMENTS;++n)this[n]/=t[n];return this.check()}lengthSq(){return this.lengthSquared()}distanceTo(e){return this.distance(e)}distanceToSquared(e){return this.distanceSquared(e)}getComponent(e){return bf(e>=0&&e<this.ELEMENTS,"index is out of range"),fe(this[e])}setComponent(e,t){return bf(e>=0&&e<this.ELEMENTS,"index is out of range"),this[e]=t,this.check()}addVectors(e,t){return this.copy(e).add(t)}subVectors(e,t){return this.copy(e).subtract(t)}multiplyVectors(e,t){return this.copy(e).multiply(t)}addScaledVector(e,t){return this.add(new this.constructor(e).multiplyScalar(t))}}const In=1e-6;let Qe=typeof Float32Array<"u"?Float32Array:Array;function OP(){const i=new Qe(2);return Qe!=Float32Array&&(i[0]=0,i[1]=0),i}function oc(i,e,t){return i[0]=e[0]+t[0],i[1]=e[1]+t[1],i}function kP(i,e,t){return i[0]=e[0]-t[0],i[1]=e[1]-t[1],i}function BP(i,e,t){return i[0]=e[0]*t,i[1]=e[1]*t,i}function DP(i){const e=i[0],t=i[1];return Math.sqrt(e*e+t*t)}function FP(i,e){return i[0]=-e[0],i[1]=-e[1],i}function mp(i,e,t,n){const s=e[0],r=e[1];return i[0]=s+n*(t[0]-s),i[1]=r+n*(t[1]-r),i}function zP(i,e,t){const n=e[0],s=e[1];return i[0]=t[0]*n+t[4]*s+t[12],i[1]=t[1]*n+t[5]*s+t[13],i}const yp=kP;(function(){const i=OP();return function(e,t,n,s,r,o){let a,c;for(t||(t=2),n||(n=0),s?c=Math.min(s*t+n,e.length):c=e.length,a=n;a<c;a+=t)i[0]=e[a],i[1]=e[a+1],r(i,i,o),e[a]=i[0],e[a+1]=i[1];return e}})();function NP(i,e,t){const n=e[0],s=e[1],r=t[3]*n+t[7]*s||1;return i[0]=(t[0]*n+t[4]*s)/r,i[1]=(t[1]*n+t[5]*s)/r,i}function _p(i,e,t){const n=e[0],s=e[1],r=e[2],o=t[3]*n+t[7]*s+t[11]*r||1;return i[0]=(t[0]*n+t[4]*s+t[8]*r)/o,i[1]=(t[1]*n+t[5]*s+t[9]*r)/o,i[2]=(t[2]*n+t[6]*s+t[10]*r)/o,i}function UP(i,e,t){const n=e[0],s=e[1];return i[0]=t[0]*n+t[2]*s,i[1]=t[1]*n+t[3]*s,i[2]=e[2],i}function $P(i,e,t){const n=e[0],s=e[1];return i[0]=t[0]*n+t[2]*s,i[1]=t[1]*n+t[3]*s,i[2]=e[2],i[3]=e[3],i}function GP(i,e,t){const n=e[0],s=e[1],r=e[2];return i[0]=t[0]*n+t[3]*s+t[6]*r,i[1]=t[1]*n+t[4]*s+t[7]*r,i[2]=t[2]*n+t[5]*s+t[8]*r,i[3]=e[3],i}function bp(){const i=new Qe(3);return Qe!=Float32Array&&(i[0]=0,i[1]=0,i[2]=0),i}function VP(i){const e=i[0],t=i[1],n=i[2];return Math.sqrt(e*e+t*t+n*n)}function vf(i,e,t){const n=new Qe(3);return n[0]=i,n[1]=e,n[2]=t,n}function jP(i,e,t){return i[0]=e[0]-t[0],i[1]=e[1]-t[1],i[2]=e[2]-t[2],i}function WP(i){const e=i[0],t=i[1],n=i[2];return e*e+t*t+n*n}function HP(i,e){return i[0]=-e[0],i[1]=-e[1],i[2]=-e[2],i}function ac(i,e){const t=e[0],n=e[1],s=e[2];let r=t*t+n*n+s*s;return r>0&&(r=1/Math.sqrt(r)),i[0]=e[0]*r,i[1]=e[1]*r,i[2]=e[2]*r,i}function ki(i,e){return i[0]*e[0]+i[1]*e[1]+i[2]*e[2]}function at(i,e,t){const n=e[0],s=e[1],r=e[2],o=t[0],a=t[1],c=t[2];return i[0]=s*c-r*a,i[1]=r*o-n*c,i[2]=n*a-s*o,i}function YP(i,e,t,n){const s=e[0],r=e[1],o=e[2];return i[0]=s+n*(t[0]-s),i[1]=r+n*(t[1]-r),i[2]=o+n*(t[2]-o),i}function Sl(i,e,t){const n=e[0],s=e[1],r=e[2];let o=t[3]*n+t[7]*s+t[11]*r+t[15];return o=o||1,i[0]=(t[0]*n+t[4]*s+t[8]*r+t[12])/o,i[1]=(t[1]*n+t[5]*s+t[9]*r+t[13])/o,i[2]=(t[2]*n+t[6]*s+t[10]*r+t[14])/o,i}function qP(i,e,t){const n=e[0],s=e[1],r=e[2];return i[0]=n*t[0]+s*t[3]+r*t[6],i[1]=n*t[1]+s*t[4]+r*t[7],i[2]=n*t[2]+s*t[5]+r*t[8],i}function El(i,e,t){const n=t[0],s=t[1],r=t[2],o=t[3],a=e[0],c=e[1],l=e[2];let u=s*l-r*c,f=r*a-n*l,d=n*c-s*a,h=s*d-r*f,g=r*u-n*d,p=n*f-s*u;const m=o*2;return u*=m,f*=m,d*=m,h*=2,g*=2,p*=2,i[0]=a+u+h,i[1]=c+f+g,i[2]=l+d+p,i}function ZP(i,e,t,n){const s=[],r=[];return s[0]=e[0]-t[0],s[1]=e[1]-t[1],s[2]=e[2]-t[2],r[0]=s[0],r[1]=s[1]*Math.cos(n)-s[2]*Math.sin(n),r[2]=s[1]*Math.sin(n)+s[2]*Math.cos(n),i[0]=r[0]+t[0],i[1]=r[1]+t[1],i[2]=r[2]+t[2],i}function XP(i,e,t,n){const s=[],r=[];return s[0]=e[0]-t[0],s[1]=e[1]-t[1],s[2]=e[2]-t[2],r[0]=s[2]*Math.sin(n)+s[0]*Math.cos(n),r[1]=s[1],r[2]=s[2]*Math.cos(n)-s[0]*Math.sin(n),i[0]=r[0]+t[0],i[1]=r[1]+t[1],i[2]=r[2]+t[2],i}function KP(i,e,t,n){const s=[],r=[];return s[0]=e[0]-t[0],s[1]=e[1]-t[1],s[2]=e[2]-t[2],r[0]=s[0]*Math.cos(n)-s[1]*Math.sin(n),r[1]=s[0]*Math.sin(n)+s[1]*Math.cos(n),r[2]=s[2],i[0]=r[0]+t[0],i[1]=r[1]+t[1],i[2]=r[2]+t[2],i}function QP(i,e){const t=i[0],n=i[1],s=i[2],r=e[0],o=e[1],a=e[2],c=Math.sqrt((t*t+n*n+s*s)*(r*r+o*o+a*a)),l=c&&ki(i,e)/c;return Math.acos(Math.min(Math.max(l,-1),1))}const vp=jP,Pr=VP,Vo=WP;(function(){const i=bp();return function(e,t,n,s,r,o){let a,c;for(t||(t=3),n||(n=0),s?c=Math.min(s*t+n,e.length):c=e.length,a=n;a<c;a+=t)i[0]=e[a],i[1]=e[a+1],i[2]=e[a+2],r(i,i,o),e[a]=i[0],e[a+1]=i[1],e[a+2]=i[2];return e}})();const jo=[0,0,0];let ws;class yt extends pp{static get ZERO(){return ws||(ws=new yt(0,0,0),Object.freeze(ws)),ws}constructor(e=0,t=0,n=0){super(-0,-0,-0),arguments.length===1&&li(e)?this.copy(e):(Oe.debug&&(fe(e),fe(t),fe(n)),this[0]=e,this[1]=t,this[2]=n)}set(e,t,n){return this[0]=e,this[1]=t,this[2]=n,this.check()}copy(e){return this[0]=e[0],this[1]=e[1],this[2]=e[2],this.check()}fromObject(e){return Oe.debug&&(fe(e.x),fe(e.y),fe(e.z)),this[0]=e.x,this[1]=e.y,this[2]=e.z,this.check()}toObject(e){return e.x=this[0],e.y=this[1],e.z=this[2],e}get ELEMENTS(){return 3}get z(){return this[2]}set z(e){this[2]=fe(e)}angle(e){return QP(this,e)}cross(e){return at(this,this,e),this.check()}rotateX({radians:e,origin:t=jo}){return ZP(this,this,t,e),this.check()}rotateY({radians:e,origin:t=jo}){return XP(this,this,t,e),this.check()}rotateZ({radians:e,origin:t=jo}){return KP(this,this,t,e),this.check()}transform(e){return this.transformAsPoint(e)}transformAsPoint(e){return Sl(this,this,e),this.check()}transformAsVector(e){return _p(this,this,e),this.check()}transformByMatrix3(e){return qP(this,this,e),this.check()}transformByMatrix2(e){return UP(this,this,e),this.check()}transformByQuaternion(e){return El(this,this,e),this.check()}}let Ps;class Cl extends pp{static get ZERO(){return Ps||(Ps=new Cl(0,0,0,0),Object.freeze(Ps)),Ps}constructor(e=0,t=0,n=0,s=0){super(-0,-0,-0,-0),li(e)&&arguments.length===1?this.copy(e):(Oe.debug&&(fe(e),fe(t),fe(n),fe(s)),this[0]=e,this[1]=t,this[2]=n,this[3]=s)}set(e,t,n,s){return this[0]=e,this[1]=t,this[2]=n,this[3]=s,this.check()}copy(e){return this[0]=e[0],this[1]=e[1],this[2]=e[2],this[3]=e[3],this.check()}fromObject(e){return Oe.debug&&(fe(e.x),fe(e.y),fe(e.z),fe(e.w)),this[0]=e.x,this[1]=e.y,this[2]=e.z,this[3]=e.w,this}toObject(e){return e.x=this[0],e.y=this[1],e.z=this[2],e.w=this[3],e}get ELEMENTS(){return 4}get z(){return this[2]}set z(e){this[2]=fe(e)}get w(){return this[3]}set w(e){this[3]=fe(e)}transform(e){return Sl(this,this,e),this.check()}transformByMatrix3(e){return GP(this,this,e),this.check()}transformByMatrix2(e){return $P(this,this,e),this.check()}transformByQuaternion(e){return El(this,this,e),this.check()}applyMatrix4(e){return e.transform(this,this),this}}class JP extends Pl{toString(){let e="[";if(Oe.printRowMajor){e+="row-major:";for(let t=0;t<this.RANK;++t)for(let n=0;n<this.RANK;++n)e+=` ${this[n*this.RANK+t]}`}else{e+="column-major:";for(let t=0;t<this.ELEMENTS;++t)e+=` ${this[t]}`}return e+="]",e}getElementIndex(e,t){return t*this.RANK+e}getElement(e,t){return this[t*this.RANK+e]}setElement(e,t,n){return this[t*this.RANK+e]=fe(n),this}getColumn(e,t=new Array(this.RANK).fill(-0)){const n=e*this.RANK;for(let s=0;s<this.RANK;++s)t[s]=this[n+s];return t}setColumn(e,t){const n=e*this.RANK;for(let s=0;s<this.RANK;++s)this[n+s]=t[s];return this}}function e2(){const i=new Qe(9);return Qe!=Float32Array&&(i[1]=0,i[2]=0,i[3]=0,i[5]=0,i[6]=0,i[7]=0),i[0]=1,i[4]=1,i[8]=1,i}function t2(i){return i[0]=1,i[1]=0,i[2]=0,i[3]=0,i[4]=0,i[5]=1,i[6]=0,i[7]=0,i[8]=0,i[9]=0,i[10]=1,i[11]=0,i[12]=0,i[13]=0,i[14]=0,i[15]=1,i}function i2(i,e){if(i===e){const t=e[1],n=e[2],s=e[3],r=e[6],o=e[7],a=e[11];i[1]=e[4],i[2]=e[8],i[3]=e[12],i[4]=t,i[6]=e[9],i[7]=e[13],i[8]=n,i[9]=r,i[11]=e[14],i[12]=s,i[13]=o,i[14]=a}else i[0]=e[0],i[1]=e[4],i[2]=e[8],i[3]=e[12],i[4]=e[1],i[5]=e[5],i[6]=e[9],i[7]=e[13],i[8]=e[2],i[9]=e[6],i[10]=e[10],i[11]=e[14],i[12]=e[3],i[13]=e[7],i[14]=e[11],i[15]=e[15];return i}function cc(i,e){const t=e[0],n=e[1],s=e[2],r=e[3],o=e[4],a=e[5],c=e[6],l=e[7],u=e[8],f=e[9],d=e[10],h=e[11],g=e[12],p=e[13],m=e[14],_=e[15],v=t*a-n*o,b=t*c-s*o,x=t*l-r*o,w=n*c-s*a,C=n*l-r*a,B=s*l-r*c,F=u*p-f*g,D=u*m-d*g,k=u*_-h*g,W=f*m-d*p,G=f*_-h*p,z=d*_-h*m;let V=v*z-b*G+x*W+w*k-C*D+B*F;return V?(V=1/V,i[0]=(a*z-c*G+l*W)*V,i[1]=(s*G-n*z-r*W)*V,i[2]=(p*B-m*C+_*w)*V,i[3]=(d*C-f*B-h*w)*V,i[4]=(c*k-o*z-l*D)*V,i[5]=(t*z-s*k+r*D)*V,i[6]=(m*x-g*B-_*b)*V,i[7]=(u*B-d*x+h*b)*V,i[8]=(o*G-a*k+l*F)*V,i[9]=(n*k-t*G-r*F)*V,i[10]=(g*C-p*x+_*v)*V,i[11]=(f*x-u*C-h*v)*V,i[12]=(a*D-o*W-c*F)*V,i[13]=(t*W-n*D+s*F)*V,i[14]=(p*b-g*w-m*v)*V,i[15]=(u*w-f*b+d*v)*V,i):null}function n2(i){const e=i[0],t=i[1],n=i[2],s=i[3],r=i[4],o=i[5],a=i[6],c=i[7],l=i[8],u=i[9],f=i[10],d=i[11],h=i[12],g=i[13],p=i[14],m=i[15],_=e*o-t*r,v=e*a-n*r,b=t*a-n*o,x=l*g-u*h,w=l*p-f*h,C=u*p-f*g,B=e*C-t*w+n*x,F=r*C-o*w+a*x,D=l*b-u*v+f*_,k=h*b-g*v+p*_;return c*B-s*F+m*D-d*k}function si(i,e,t){const n=e[0],s=e[1],r=e[2],o=e[3],a=e[4],c=e[5],l=e[6],u=e[7],f=e[8],d=e[9],h=e[10],g=e[11],p=e[12],m=e[13],_=e[14],v=e[15];let b=t[0],x=t[1],w=t[2],C=t[3];return i[0]=b*n+x*a+w*f+C*p,i[1]=b*s+x*c+w*d+C*m,i[2]=b*r+x*l+w*h+C*_,i[3]=b*o+x*u+w*g+C*v,b=t[4],x=t[5],w=t[6],C=t[7],i[4]=b*n+x*a+w*f+C*p,i[5]=b*s+x*c+w*d+C*m,i[6]=b*r+x*l+w*h+C*_,i[7]=b*o+x*u+w*g+C*v,b=t[8],x=t[9],w=t[10],C=t[11],i[8]=b*n+x*a+w*f+C*p,i[9]=b*s+x*c+w*d+C*m,i[10]=b*r+x*l+w*h+C*_,i[11]=b*o+x*u+w*g+C*v,b=t[12],x=t[13],w=t[14],C=t[15],i[12]=b*n+x*a+w*f+C*p,i[13]=b*s+x*c+w*d+C*m,i[14]=b*r+x*l+w*h+C*_,i[15]=b*o+x*u+w*g+C*v,i}function Sr(i,e,t){const n=t[0],s=t[1],r=t[2];let o,a,c,l,u,f,d,h,g,p,m,_;return e===i?(i[12]=e[0]*n+e[4]*s+e[8]*r+e[12],i[13]=e[1]*n+e[5]*s+e[9]*r+e[13],i[14]=e[2]*n+e[6]*s+e[10]*r+e[14],i[15]=e[3]*n+e[7]*s+e[11]*r+e[15]):(o=e[0],a=e[1],c=e[2],l=e[3],u=e[4],f=e[5],d=e[6],h=e[7],g=e[8],p=e[9],m=e[10],_=e[11],i[0]=o,i[1]=a,i[2]=c,i[3]=l,i[4]=u,i[5]=f,i[6]=d,i[7]=h,i[8]=g,i[9]=p,i[10]=m,i[11]=_,i[12]=o*n+u*s+g*r+e[12],i[13]=a*n+f*s+p*r+e[13],i[14]=c*n+d*s+m*r+e[14],i[15]=l*n+h*s+_*r+e[15]),i}function Ll(i,e,t){const n=t[0],s=t[1],r=t[2];return i[0]=e[0]*n,i[1]=e[1]*n,i[2]=e[2]*n,i[3]=e[3]*n,i[4]=e[4]*s,i[5]=e[5]*s,i[6]=e[6]*s,i[7]=e[7]*s,i[8]=e[8]*r,i[9]=e[9]*r,i[10]=e[10]*r,i[11]=e[11]*r,i[12]=e[12],i[13]=e[13],i[14]=e[14],i[15]=e[15],i}function s2(i,e,t,n){let s=n[0],r=n[1],o=n[2],a=Math.sqrt(s*s+r*r+o*o),c,l,u,f,d,h,g,p,m,_,v,b,x,w,C,B,F,D,k,W,G,z,V,J;return a<In?null:(a=1/a,s*=a,r*=a,o*=a,l=Math.sin(t),c=Math.cos(t),u=1-c,f=e[0],d=e[1],h=e[2],g=e[3],p=e[4],m=e[5],_=e[6],v=e[7],b=e[8],x=e[9],w=e[10],C=e[11],B=s*s*u+c,F=r*s*u+o*l,D=o*s*u-r*l,k=s*r*u-o*l,W=r*r*u+c,G=o*r*u+s*l,z=s*o*u+r*l,V=r*o*u-s*l,J=o*o*u+c,i[0]=f*B+p*F+b*D,i[1]=d*B+m*F+x*D,i[2]=h*B+_*F+w*D,i[3]=g*B+v*F+C*D,i[4]=f*k+p*W+b*G,i[5]=d*k+m*W+x*G,i[6]=h*k+_*W+w*G,i[7]=g*k+v*W+C*G,i[8]=f*z+p*V+b*J,i[9]=d*z+m*V+x*J,i[10]=h*z+_*V+w*J,i[11]=g*z+v*V+C*J,e!==i&&(i[12]=e[12],i[13]=e[13],i[14]=e[14],i[15]=e[15]),i)}function xp(i,e,t){const n=Math.sin(t),s=Math.cos(t),r=e[4],o=e[5],a=e[6],c=e[7],l=e[8],u=e[9],f=e[10],d=e[11];return e!==i&&(i[0]=e[0],i[1]=e[1],i[2]=e[2],i[3]=e[3],i[12]=e[12],i[13]=e[13],i[14]=e[14],i[15]=e[15]),i[4]=r*s+l*n,i[5]=o*s+u*n,i[6]=a*s+f*n,i[7]=c*s+d*n,i[8]=l*s-r*n,i[9]=u*s-o*n,i[10]=f*s-a*n,i[11]=d*s-c*n,i}function r2(i,e,t){const n=Math.sin(t),s=Math.cos(t),r=e[0],o=e[1],a=e[2],c=e[3],l=e[8],u=e[9],f=e[10],d=e[11];return e!==i&&(i[4]=e[4],i[5]=e[5],i[6]=e[6],i[7]=e[7],i[12]=e[12],i[13]=e[13],i[14]=e[14],i[15]=e[15]),i[0]=r*s-l*n,i[1]=o*s-u*n,i[2]=a*s-f*n,i[3]=c*s-d*n,i[8]=r*n+l*s,i[9]=o*n+u*s,i[10]=a*n+f*s,i[11]=c*n+d*s,i}function wp(i,e,t){const n=Math.sin(t),s=Math.cos(t),r=e[0],o=e[1],a=e[2],c=e[3],l=e[4],u=e[5],f=e[6],d=e[7];return e!==i&&(i[8]=e[8],i[9]=e[9],i[10]=e[10],i[11]=e[11],i[12]=e[12],i[13]=e[13],i[14]=e[14],i[15]=e[15]),i[0]=r*s+l*n,i[1]=o*s+u*n,i[2]=a*s+f*n,i[3]=c*s+d*n,i[4]=l*s-r*n,i[5]=u*s-o*n,i[6]=f*s-a*n,i[7]=d*s-c*n,i}function o2(i,e){const t=e[0],n=e[1],s=e[2],r=e[3],o=t+t,a=n+n,c=s+s,l=t*o,u=n*o,f=n*a,d=s*o,h=s*a,g=s*c,p=r*o,m=r*a,_=r*c;return i[0]=1-f-g,i[1]=u+_,i[2]=d-m,i[3]=0,i[4]=u-_,i[5]=1-l-g,i[6]=h+p,i[7]=0,i[8]=d+m,i[9]=h-p,i[10]=1-l-f,i[11]=0,i[12]=0,i[13]=0,i[14]=0,i[15]=1,i}function a2(i,e,t,n,s,r,o){const a=1/(t-e),c=1/(s-n),l=1/(r-o);return i[0]=r*2*a,i[1]=0,i[2]=0,i[3]=0,i[4]=0,i[5]=r*2*c,i[6]=0,i[7]=0,i[8]=(t+e)*a,i[9]=(s+n)*c,i[10]=(o+r)*l,i[11]=-1,i[12]=0,i[13]=0,i[14]=o*r*2*l,i[15]=0,i}function c2(i,e,t,n,s){const r=1/Math.tan(e/2);if(i[0]=r/t,i[1]=0,i[2]=0,i[3]=0,i[4]=0,i[5]=r,i[6]=0,i[7]=0,i[8]=0,i[9]=0,i[11]=-1,i[12]=0,i[13]=0,i[15]=0,s!=null&&s!==1/0){const o=1/(n-s);i[10]=(s+n)*o,i[14]=2*s*n*o}else i[10]=-1,i[14]=-2*n;return i}const l2=c2;function u2(i,e,t,n,s,r,o){const a=1/(e-t),c=1/(n-s),l=1/(r-o);return i[0]=-2*a,i[1]=0,i[2]=0,i[3]=0,i[4]=0,i[5]=-2*c,i[6]=0,i[7]=0,i[8]=0,i[9]=0,i[10]=2*l,i[11]=0,i[12]=(e+t)*a,i[13]=(s+n)*c,i[14]=(o+r)*l,i[15]=1,i}const f2=u2;function d2(i,e,t,n){let s,r,o,a,c,l,u,f,d,h;const g=e[0],p=e[1],m=e[2],_=n[0],v=n[1],b=n[2],x=t[0],w=t[1],C=t[2];return Math.abs(g-x)<In&&Math.abs(p-w)<In&&Math.abs(m-C)<In?t2(i):(f=g-x,d=p-w,h=m-C,s=1/Math.sqrt(f*f+d*d+h*h),f*=s,d*=s,h*=s,r=v*h-b*d,o=b*f-_*h,a=_*d-v*f,s=Math.sqrt(r*r+o*o+a*a),s?(s=1/s,r*=s,o*=s,a*=s):(r=0,o=0,a=0),c=d*a-h*o,l=h*r-f*a,u=f*o-d*r,s=Math.sqrt(c*c+l*l+u*u),s?(s=1/s,c*=s,l*=s,u*=s):(c=0,l=0,u=0),i[0]=r,i[1]=c,i[2]=f,i[3]=0,i[4]=o,i[5]=l,i[6]=d,i[7]=0,i[8]=a,i[9]=u,i[10]=h,i[11]=0,i[12]=-(r*g+o*p+a*m),i[13]=-(c*g+l*p+u*m),i[14]=-(f*g+d*p+h*m),i[15]=1,i)}function h2(){const i=new Qe(4);return Qe!=Float32Array&&(i[0]=0,i[1]=0,i[2]=0,i[3]=0),i}function g2(i,e,t){return i[0]=e[0]+t[0],i[1]=e[1]+t[1],i[2]=e[2]+t[2],i[3]=e[3]+t[3],i}function Tl(i,e,t){return i[0]=e[0]*t,i[1]=e[1]*t,i[2]=e[2]*t,i[3]=e[3]*t,i}function p2(i){const e=i[0],t=i[1],n=i[2],s=i[3];return Math.sqrt(e*e+t*t+n*n+s*s)}function m2(i){const e=i[0],t=i[1],n=i[2],s=i[3];return e*e+t*t+n*n+s*s}function y2(i,e){const t=e[0],n=e[1],s=e[2],r=e[3];let o=t*t+n*n+s*s+r*r;return o>0&&(o=1/Math.sqrt(o)),i[0]=t*o,i[1]=n*o,i[2]=s*o,i[3]=r*o,i}function _2(i,e){return i[0]*e[0]+i[1]*e[1]+i[2]*e[2]+i[3]*e[3]}function b2(i,e,t,n){const s=e[0],r=e[1],o=e[2],a=e[3];return i[0]=s+n*(t[0]-s),i[1]=r+n*(t[1]-r),i[2]=o+n*(t[2]-o),i[3]=a+n*(t[3]-a),i}function rn(i,e,t){const n=e[0],s=e[1],r=e[2],o=e[3];return i[0]=t[0]*n+t[4]*s+t[8]*r+t[12]*o,i[1]=t[1]*n+t[5]*s+t[9]*r+t[13]*o,i[2]=t[2]*n+t[6]*s+t[10]*r+t[14]*o,i[3]=t[3]*n+t[7]*s+t[11]*r+t[15]*o,i}function v2(i,e,t){const n=e[0],s=e[1],r=e[2],o=t[0],a=t[1],c=t[2],l=t[3],u=l*n+a*r-c*s,f=l*s+c*n-o*r,d=l*r+o*s-a*n,h=-o*n-a*s-c*r;return i[0]=u*l+h*-o+f*-c-d*-a,i[1]=f*l+h*-a+d*-o-u*-c,i[2]=d*l+h*-c+u*-a-f*-o,i[3]=e[3],i}(function(){const i=h2();return function(e,t,n,s,r,o){let a,c;for(t||(t=4),n||(n=0),s?c=Math.min(s*t+n,e.length):c=e.length,a=n;a<c;a+=t)i[0]=e[a],i[1]=e[a+1],i[2]=e[a+2],i[3]=e[a+3],r(i,i,o),e[a]=i[0],e[a+1]=i[1],e[a+2]=i[2],e[a+3]=i[3];return e}})();var lc;(function(i){i[i.COL0ROW0=0]="COL0ROW0",i[i.COL0ROW1=1]="COL0ROW1",i[i.COL0ROW2=2]="COL0ROW2",i[i.COL0ROW3=3]="COL0ROW3",i[i.COL1ROW0=4]="COL1ROW0",i[i.COL1ROW1=5]="COL1ROW1",i[i.COL1ROW2=6]="COL1ROW2",i[i.COL1ROW3=7]="COL1ROW3",i[i.COL2ROW0=8]="COL2ROW0",i[i.COL2ROW1=9]="COL2ROW1",i[i.COL2ROW2=10]="COL2ROW2",i[i.COL2ROW3=11]="COL2ROW3",i[i.COL3ROW0=12]="COL3ROW0",i[i.COL3ROW1=13]="COL3ROW1",i[i.COL3ROW2=14]="COL3ROW2",i[i.COL3ROW3=15]="COL3ROW3"})(lc||(lc={}));const x2=45*Math.PI/180,w2=1,Wo=.1,Ho=500,P2=Object.freeze([1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]);class Je extends JP{static get IDENTITY(){return E2()}static get ZERO(){return S2()}get ELEMENTS(){return 16}get RANK(){return 4}get INDICES(){return lc}constructor(e){super(-0,-0,-0,-0,-0,-0,-0,-0,-0,-0,-0,-0,-0,-0,-0,-0),arguments.length===1&&Array.isArray(e)?this.copy(e):this.identity()}copy(e){return this[0]=e[0],this[1]=e[1],this[2]=e[2],this[3]=e[3],this[4]=e[4],this[5]=e[5],this[6]=e[6],this[7]=e[7],this[8]=e[8],this[9]=e[9],this[10]=e[10],this[11]=e[11],this[12]=e[12],this[13]=e[13],this[14]=e[14],this[15]=e[15],this.check()}set(e,t,n,s,r,o,a,c,l,u,f,d,h,g,p,m){return this[0]=e,this[1]=t,this[2]=n,this[3]=s,this[4]=r,this[5]=o,this[6]=a,this[7]=c,this[8]=l,this[9]=u,this[10]=f,this[11]=d,this[12]=h,this[13]=g,this[14]=p,this[15]=m,this.check()}setRowMajor(e,t,n,s,r,o,a,c,l,u,f,d,h,g,p,m){return this[0]=e,this[1]=r,this[2]=l,this[3]=h,this[4]=t,this[5]=o,this[6]=u,this[7]=g,this[8]=n,this[9]=a,this[10]=f,this[11]=p,this[12]=s,this[13]=c,this[14]=d,this[15]=m,this.check()}toRowMajor(e){return e[0]=this[0],e[1]=this[4],e[2]=this[8],e[3]=this[12],e[4]=this[1],e[5]=this[5],e[6]=this[9],e[7]=this[13],e[8]=this[2],e[9]=this[6],e[10]=this[10],e[11]=this[14],e[12]=this[3],e[13]=this[7],e[14]=this[11],e[15]=this[15],e}identity(){return this.copy(P2)}fromObject(e){return this.check()}fromQuaternion(e){return o2(this,e),this.check()}frustum(e){const{left:t,right:n,bottom:s,top:r,near:o=Wo,far:a=Ho}=e;return a===1/0?C2(this,t,n,s,r,o):a2(this,t,n,s,r,o,a),this.check()}lookAt(e){const{eye:t,center:n=[0,0,0],up:s=[0,1,0]}=e;return d2(this,t,n,s),this.check()}ortho(e){const{left:t,right:n,bottom:s,top:r,near:o=Wo,far:a=Ho}=e;return f2(this,t,n,s,r,o,a),this.check()}orthographic(e){const{fovy:t=x2,aspect:n=w2,focalDistance:s=1,near:r=Wo,far:o=Ho}=e;xf(t);const a=t/2,c=s*Math.tan(a),l=c*n;return this.ortho({left:-l,right:l,bottom:-c,top:c,near:r,far:o})}perspective(e){const{fovy:t=45*Math.PI/180,aspect:n=1,near:s=.1,far:r=500}=e;return xf(t),l2(this,t,n,s,r),this.check()}determinant(){return n2(this)}getScale(e=[-0,-0,-0]){return e[0]=Math.sqrt(this[0]*this[0]+this[1]*this[1]+this[2]*this[2]),e[1]=Math.sqrt(this[4]*this[4]+this[5]*this[5]+this[6]*this[6]),e[2]=Math.sqrt(this[8]*this[8]+this[9]*this[9]+this[10]*this[10]),e}getTranslation(e=[-0,-0,-0]){return e[0]=this[12],e[1]=this[13],e[2]=this[14],e}getRotation(e,t){e=e||[-0,-0,-0,-0,-0,-0,-0,-0,-0,-0,-0,-0,-0,-0,-0,-0],t=t||[-0,-0,-0];const n=this.getScale(t),s=1/n[0],r=1/n[1],o=1/n[2];return e[0]=this[0]*s,e[1]=this[1]*r,e[2]=this[2]*o,e[3]=0,e[4]=this[4]*s,e[5]=this[5]*r,e[6]=this[6]*o,e[7]=0,e[8]=this[8]*s,e[9]=this[9]*r,e[10]=this[10]*o,e[11]=0,e[12]=0,e[13]=0,e[14]=0,e[15]=1,e}getRotationMatrix3(e,t){e=e||[-0,-0,-0,-0,-0,-0,-0,-0,-0],t=t||[-0,-0,-0];const n=this.getScale(t),s=1/n[0],r=1/n[1],o=1/n[2];return e[0]=this[0]*s,e[1]=this[1]*r,e[2]=this[2]*o,e[3]=this[4]*s,e[4]=this[5]*r,e[5]=this[6]*o,e[6]=this[8]*s,e[7]=this[9]*r,e[8]=this[10]*o,e}transpose(){return i2(this,this),this.check()}invert(){return cc(this,this),this.check()}multiplyLeft(e){return si(this,e,this),this.check()}multiplyRight(e){return si(this,this,e),this.check()}rotateX(e){return xp(this,this,e),this.check()}rotateY(e){return r2(this,this,e),this.check()}rotateZ(e){return wp(this,this,e),this.check()}rotateXYZ(e){return this.rotateX(e[0]).rotateY(e[1]).rotateZ(e[2])}rotateAxis(e,t){return s2(this,this,e,t),this.check()}scale(e){return Ll(this,this,Array.isArray(e)?e:[e,e,e]),this.check()}translate(e){return Sr(this,this,e),this.check()}transform(e,t){return e.length===4?(t=rn(t||[-0,-0,-0,-0],e,this),$s(t,4),t):this.transformAsPoint(e,t)}transformAsPoint(e,t){const{length:n}=e;let s;switch(n){case 2:s=zP(t||[-0,-0],e,this);break;case 3:s=Sl(t||[-0,-0,-0],e,this);break;default:throw new Error("Illegal vector")}return $s(s,e.length),s}transformAsVector(e,t){let n;switch(e.length){case 2:n=NP(t||[-0,-0],e,this);break;case 3:n=_p(t||[-0,-0,-0],e,this);break;default:throw new Error("Illegal vector")}return $s(n,e.length),n}transformPoint(e,t){return this.transformAsPoint(e,t)}transformVector(e,t){return this.transformAsPoint(e,t)}transformDirection(e,t){return this.transformAsVector(e,t)}makeRotationX(e){return this.identity().rotateX(e)}makeTranslation(e,t,n){return this.identity().translate([e,t,n])}}let Ss,Es;function S2(){return Ss||(Ss=new Je([0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0]),Object.freeze(Ss)),Ss}function E2(){return Es||(Es=new Je,Object.freeze(Es)),Es}function xf(i){if(i>Math.PI*2)throw Error("expected radians")}function C2(i,e,t,n,s,r){const o=2*r/(t-e),a=2*r/(s-n),c=(t+e)/(t-e),l=(s+n)/(s-n),u=-1,f=-1,d=-2*r;return i[0]=o,i[1]=0,i[2]=0,i[3]=0,i[4]=0,i[5]=a,i[6]=0,i[7]=0,i[8]=c,i[9]=l,i[10]=u,i[11]=f,i[12]=0,i[13]=0,i[14]=d,i[15]=0,i}function wf(){const i=new Qe(4);return Qe!=Float32Array&&(i[0]=0,i[1]=0,i[2]=0),i[3]=1,i}function L2(i){return i[0]=0,i[1]=0,i[2]=0,i[3]=1,i}function Pp(i,e,t){t=t*.5;const n=Math.sin(t);return i[0]=n*e[0],i[1]=n*e[1],i[2]=n*e[2],i[3]=Math.cos(t),i}function Pf(i,e,t){const n=e[0],s=e[1],r=e[2],o=e[3],a=t[0],c=t[1],l=t[2],u=t[3];return i[0]=n*u+o*a+s*l-r*c,i[1]=s*u+o*c+r*a-n*l,i[2]=r*u+o*l+n*c-s*a,i[3]=o*u-n*a-s*c-r*l,i}function T2(i,e,t){t*=.5;const n=e[0],s=e[1],r=e[2],o=e[3],a=Math.sin(t),c=Math.cos(t);return i[0]=n*c+o*a,i[1]=s*c+r*a,i[2]=r*c-s*a,i[3]=o*c-n*a,i}function A2(i,e,t){t*=.5;const n=e[0],s=e[1],r=e[2],o=e[3],a=Math.sin(t),c=Math.cos(t);return i[0]=n*c-r*a,i[1]=s*c+o*a,i[2]=r*c+n*a,i[3]=o*c-s*a,i}function M2(i,e,t){t*=.5;const n=e[0],s=e[1],r=e[2],o=e[3],a=Math.sin(t),c=Math.cos(t);return i[0]=n*c+s*a,i[1]=s*c-n*a,i[2]=r*c+o*a,i[3]=o*c-r*a,i}function I2(i,e){const t=e[0],n=e[1],s=e[2];return i[0]=t,i[1]=n,i[2]=s,i[3]=Math.sqrt(Math.abs(1-t*t-n*n-s*s)),i}function Gs(i,e,t,n){const s=e[0],r=e[1],o=e[2],a=e[3];let c=t[0],l=t[1],u=t[2],f=t[3],d,h,g,p,m;return d=s*c+r*l+o*u+a*f,d<0&&(d=-d,c=-c,l=-l,u=-u,f=-f),1-d>In?(h=Math.acos(d),m=Math.sin(h),g=Math.sin((1-n)*h)/m,p=Math.sin(n*h)/m):(g=1-n,p=n),i[0]=g*s+p*c,i[1]=g*r+p*l,i[2]=g*o+p*u,i[3]=g*a+p*f,i}function R2(i,e){const t=e[0],n=e[1],s=e[2],r=e[3],o=t*t+n*n+s*s+r*r,a=o?1/o:0;return i[0]=-t*a,i[1]=-n*a,i[2]=-s*a,i[3]=r*a,i}function O2(i,e){return i[0]=-e[0],i[1]=-e[1],i[2]=-e[2],i[3]=e[3],i}function Sp(i,e){const t=e[0]+e[4]+e[8];let n;if(t>0)n=Math.sqrt(t+1),i[3]=.5*n,n=.5/n,i[0]=(e[5]-e[7])*n,i[1]=(e[6]-e[2])*n,i[2]=(e[1]-e[3])*n;else{let s=0;e[4]>e[0]&&(s=1),e[8]>e[s*3+s]&&(s=2);const r=(s+1)%3,o=(s+2)%3;n=Math.sqrt(e[s*3+s]-e[r*3+r]-e[o*3+o]+1),i[s]=.5*n,n=.5/n,i[3]=(e[r*3+o]-e[o*3+r])*n,i[r]=(e[r*3+s]+e[s*3+r])*n,i[o]=(e[o*3+s]+e[s*3+o])*n}return i}const k2=g2,B2=Tl,D2=_2,F2=b2,z2=p2,N2=m2,Ep=y2,U2=(function(){const i=bp(),e=vf(1,0,0),t=vf(0,1,0);return function(n,s,r){const o=ki(s,r);return o<-.999999?(at(i,e,s),Pr(i)<1e-6&&at(i,t,s),ac(i,i),Pp(n,i,Math.PI),n):o>.999999?(n[0]=0,n[1]=0,n[2]=0,n[3]=1,n):(at(i,s,r),n[0]=i[0],n[1]=i[1],n[2]=i[2],n[3]=1+o,Ep(n,n))}})();(function(){const i=wf(),e=wf();return function(t,n,s,r,o,a){return Gs(i,n,o,a),Gs(e,s,r,a),Gs(t,i,e,2*a*(1-a)),t}})();(function(){const i=e2();return function(e,t,n,s){return i[0]=n[0],i[3]=n[1],i[6]=n[2],i[1]=s[0],i[4]=s[1],i[7]=s[2],i[2]=-t[0],i[5]=-t[1],i[8]=-t[2],Ep(e,Sp(e,i))}})();const $2=[0,0,0,1];class G2 extends Pl{constructor(e=0,t=0,n=0,s=1){super(-0,-0,-0,-0),Array.isArray(e)&&arguments.length===1?this.copy(e):this.set(e,t,n,s)}copy(e){return this[0]=e[0],this[1]=e[1],this[2]=e[2],this[3]=e[3],this.check()}set(e,t,n,s){return this[0]=e,this[1]=t,this[2]=n,this[3]=s,this.check()}fromObject(e){return this[0]=e.x,this[1]=e.y,this[2]=e.z,this[3]=e.w,this.check()}fromMatrix3(e){return Sp(this,e),this.check()}fromAxisRotation(e,t){return Pp(this,e,t),this.check()}identity(){return L2(this),this.check()}setAxisAngle(e,t){return this.fromAxisRotation(e,t)}get ELEMENTS(){return 4}get x(){return this[0]}set x(e){this[0]=fe(e)}get y(){return this[1]}set y(e){this[1]=fe(e)}get z(){return this[2]}set z(e){this[2]=fe(e)}get w(){return this[3]}set w(e){this[3]=fe(e)}len(){return z2(this)}lengthSquared(){return N2(this)}dot(e){return D2(this,e)}rotationTo(e,t){return U2(this,e,t),this.check()}add(e){return k2(this,this,e),this.check()}calculateW(){return I2(this,this),this.check()}conjugate(){return O2(this,this),this.check()}invert(){return R2(this,this),this.check()}lerp(e,t,n){return n===void 0?this.lerp(this,e,t):(F2(this,e,t,n),this.check())}multiplyRight(e){return Pf(this,this,e),this.check()}multiplyLeft(e){return Pf(this,e,this),this.check()}normalize(){const e=this.len(),t=e>0?1/e:0;return this[0]=this[0]*t,this[1]=this[1]*t,this[2]=this[2]*t,this[3]=this[3]*t,e===0&&(this[3]=1),this.check()}rotateX(e){return T2(this,this,e),this.check()}rotateY(e){return A2(this,this,e),this.check()}rotateZ(e){return M2(this,this,e),this.check()}scale(e){return B2(this,this,e),this.check()}slerp(e,t,n){let s,r,o;switch(arguments.length){case 1:({start:s=$2,target:r,ratio:o}=e);break;case 2:s=this,r=e,o=t;break;default:s=e,r=t,o=n}return Gs(this,s,r,o),this.check()}transformVector4(e,t=new Cl){return v2(t,e,this),$s(t,4)}lengthSq(){return this.lengthSquared()}setFromAxisAngle(e,t){return this.setAxisAngle(e,t)}premultiply(e){return this.multiplyLeft(e)}multiply(e){return this.multiplyRight(e)}}function Cp(i,e=[],t=0){const n=Math.fround(i),s=i-n;return e[t]=n,e[t+1]=s,e}function V2(i){return i-Math.fround(i)}function j2(i){const e=new Float32Array(32);for(let t=0;t<4;++t)for(let n=0;n<4;++n){const s=t*4+n;Cp(i[n*4+t],e,s*2)}return e}function Lp(i,e=!0){return i??e}function Tp(i=[0,0,0],e=!0){return e?i.map(t=>t/255):[...i]}function W2(i,e=!0){const t=Tp(i.slice(0,3),e),n=Number.isFinite(i[3]),s=n?i[3]:1;return[t[0],t[1],t[2],e&&n?s/255:s]}const H2=`#ifdef LUMA_FP32_TAN_PRECISION_WORKAROUND

// All these functions are for substituting tan() function from Intel GPU only
const float TWO_PI = 6.2831854820251465;
const float PI_2 = 1.5707963705062866;
const float PI_16 = 0.1963495463132858;

const float SIN_TABLE_0 = 0.19509032368659973;
const float SIN_TABLE_1 = 0.3826834261417389;
const float SIN_TABLE_2 = 0.5555702447891235;
const float SIN_TABLE_3 = 0.7071067690849304;

const float COS_TABLE_0 = 0.9807852506637573;
const float COS_TABLE_1 = 0.9238795042037964;
const float COS_TABLE_2 = 0.8314695954322815;
const float COS_TABLE_3 = 0.7071067690849304;

const float INVERSE_FACTORIAL_3 = 1.666666716337204e-01; // 1/3!
const float INVERSE_FACTORIAL_5 = 8.333333767950535e-03; // 1/5!
const float INVERSE_FACTORIAL_7 = 1.9841270113829523e-04; // 1/7!
const float INVERSE_FACTORIAL_9 = 2.75573188446287533e-06; // 1/9!

float sin_taylor_fp32(float a) {
  float r, s, t, x;

  if (a == 0.0) {
    return 0.0;
  }

  x = -a * a;
  s = a;
  r = a;

  r = r * x;
  t = r * INVERSE_FACTORIAL_3;
  s = s + t;

  r = r * x;
  t = r * INVERSE_FACTORIAL_5;
  s = s + t;

  r = r * x;
  t = r * INVERSE_FACTORIAL_7;
  s = s + t;

  r = r * x;
  t = r * INVERSE_FACTORIAL_9;
  s = s + t;

  return s;
}

void sincos_taylor_fp32(float a, out float sin_t, out float cos_t) {
  if (a == 0.0) {
    sin_t = 0.0;
    cos_t = 1.0;
  }
  sin_t = sin_taylor_fp32(a);
  cos_t = sqrt(1.0 - sin_t * sin_t);
}

float tan_taylor_fp32(float a) {
    float sin_a;
    float cos_a;

    if (a == 0.0) {
        return 0.0;
    }

    // 2pi range reduction
    float z = floor(a / TWO_PI);
    float r = a - TWO_PI * z;

    float t;
    float q = floor(r / PI_2 + 0.5);
    int j = int(q);

    if (j < -2 || j > 2) {
        return 1.0 / 0.0;
    }

    t = r - PI_2 * q;

    q = floor(t / PI_16 + 0.5);
    int k = int(q);
    int abs_k = int(abs(float(k)));

    if (abs_k > 4) {
        return 1.0 / 0.0;
    } else {
        t = t - PI_16 * q;
    }

    float u = 0.0;
    float v = 0.0;

    float sin_t, cos_t;
    float s, c;
    sincos_taylor_fp32(t, sin_t, cos_t);

    if (k == 0) {
        s = sin_t;
        c = cos_t;
    } else {
        if (abs(float(abs_k) - 1.0) < 0.5) {
            u = COS_TABLE_0;
            v = SIN_TABLE_0;
        } else if (abs(float(abs_k) - 2.0) < 0.5) {
            u = COS_TABLE_1;
            v = SIN_TABLE_1;
        } else if (abs(float(abs_k) - 3.0) < 0.5) {
            u = COS_TABLE_2;
            v = SIN_TABLE_2;
        } else if (abs(float(abs_k) - 4.0) < 0.5) {
            u = COS_TABLE_3;
            v = SIN_TABLE_3;
        }
        if (k > 0) {
            s = u * sin_t + v * cos_t;
            c = u * cos_t - v * sin_t;
        } else {
            s = u * sin_t - v * cos_t;
            c = u * cos_t + v * sin_t;
        }
    }

    if (j == 0) {
        sin_a = s;
        cos_a = c;
    } else if (j == 1) {
        sin_a = c;
        cos_a = -s;
    } else if (j == -1) {
        sin_a = -c;
        cos_a = s;
    } else {
        sin_a = -s;
        cos_a = -c;
    }
    return sin_a / cos_a;
}
#endif

float tan_fp32(float a) {
#ifdef LUMA_FP32_TAN_PRECISION_WORKAROUND
  return tan_taylor_fp32(a);
#else
  return tan(a);
#endif
}
`,Y2=`#ifdef LUMA_FP32_TAN_PRECISION_WORKAROUND
const FP32_TWO_PI: f32 = 6.2831854820251465;
const FP32_PI_2: f32 = 1.5707963705062866;
const FP32_PI_16: f32 = 0.1963495463132858;

const FP32_SIN_TABLE_0: f32 = 0.19509032368659973;
const FP32_SIN_TABLE_1: f32 = 0.3826834261417389;
const FP32_SIN_TABLE_2: f32 = 0.5555702447891235;
const FP32_SIN_TABLE_3: f32 = 0.7071067690849304;

const FP32_COS_TABLE_0: f32 = 0.9807852506637573;
const FP32_COS_TABLE_1: f32 = 0.9238795042037964;
const FP32_COS_TABLE_2: f32 = 0.8314695954322815;
const FP32_COS_TABLE_3: f32 = 0.7071067690849304;

const FP32_INVERSE_FACTORIAL_3: f32 = 1.666666716337204e-01;
const FP32_INVERSE_FACTORIAL_5: f32 = 8.333333767950535e-03;
const FP32_INVERSE_FACTORIAL_7: f32 = 1.9841270113829523e-04;
const FP32_INVERSE_FACTORIAL_9: f32 = 2.75573188446287533e-06;
const FP32_OVERFLOW: f32 = 3.402823466e+38;

fn sin_taylor_fp32(a: f32) -> f32 {
  if (a == 0.0) {
    return 0.0;
  }

  let x = -a * a;
  var sum = a;
  var term = a;

  term = term * x;
  sum = sum + term * FP32_INVERSE_FACTORIAL_3;
  term = term * x;
  sum = sum + term * FP32_INVERSE_FACTORIAL_5;
  term = term * x;
  sum = sum + term * FP32_INVERSE_FACTORIAL_7;
  term = term * x;
  sum = sum + term * FP32_INVERSE_FACTORIAL_9;

  return sum;
}

fn tan_taylor_fp32(a: f32) -> f32 {
  if (a == 0.0) {
    return 0.0;
  }

  let z = floor(a / FP32_TWO_PI);
  let reduced = a - FP32_TWO_PI * z;

  var quadrantValue = floor(reduced / FP32_PI_2 + 0.5);
  let quadrant = i32(quadrantValue);
  if (quadrant < -2 || quadrant > 2) {
    return FP32_OVERFLOW;
  }

  var angle = reduced - FP32_PI_2 * quadrantValue;
  quadrantValue = floor(angle / FP32_PI_16 + 0.5);
  let tableIndex = i32(quadrantValue);
  let absoluteTableIndex = abs(tableIndex);
  if (absoluteTableIndex > 4) {
    return FP32_OVERFLOW;
  }

  angle = angle - FP32_PI_16 * quadrantValue;
  let sinAngle = sin_taylor_fp32(angle);
  let cosAngle = sqrt(1.0 - sinAngle * sinAngle);

  var tableCos = 0.0;
  var tableSin = 0.0;
  if (absoluteTableIndex == 1) {
    tableCos = FP32_COS_TABLE_0;
    tableSin = FP32_SIN_TABLE_0;
  } else if (absoluteTableIndex == 2) {
    tableCos = FP32_COS_TABLE_1;
    tableSin = FP32_SIN_TABLE_1;
  } else if (absoluteTableIndex == 3) {
    tableCos = FP32_COS_TABLE_2;
    tableSin = FP32_SIN_TABLE_2;
  } else if (absoluteTableIndex == 4) {
    tableCos = FP32_COS_TABLE_3;
    tableSin = FP32_SIN_TABLE_3;
  }

  var sinReduced = sinAngle;
  var cosReduced = cosAngle;
  if (tableIndex > 0) {
    sinReduced = tableCos * sinAngle + tableSin * cosAngle;
    cosReduced = tableCos * cosAngle - tableSin * sinAngle;
  } else if (tableIndex < 0) {
    sinReduced = tableCos * sinAngle - tableSin * cosAngle;
    cosReduced = tableCos * cosAngle + tableSin * sinAngle;
  }

  var sinValue = 0.0;
  var cosValue = 0.0;
  if (quadrant == 0) {
    sinValue = sinReduced;
    cosValue = cosReduced;
  } else if (quadrant == 1) {
    sinValue = cosReduced;
    cosValue = -sinReduced;
  } else if (quadrant == -1) {
    sinValue = -cosReduced;
    cosValue = sinReduced;
  } else {
    sinValue = -sinReduced;
    cosValue = -cosReduced;
  }

  return sinValue / cosValue;
}

fn tan_fp32(a: f32) -> f32 {
  return tan_taylor_fp32(a);
}
#else
fn tan_fp32(a: f32) -> f32 {
  return tan(a);
}
#endif
`,q2={name:"fp32",source:Y2,vs:H2},Sf=`
layout(std140) uniform fp64arithmeticUniforms {
  uniform float ONE;
  uniform float SPLIT;
} fp64;

/*
About LUMA_FP64_CODE_ELIMINATION_WORKAROUND

The purpose of this workaround is to prevent shader compilers from
optimizing away necessary arithmetic operations by swapping their sequences
or transform the equation to some 'equivalent' form.

These helpers implement Dekker/Veltkamp-style error tracking. If the compiler
folds constants or reassociates the arithmetic, the high/low split can stop
tracking the rounding error correctly. That failure mode tends to look fine in
simple coordinate setup, but then breaks down inside iterative arithmetic such
as fp64 Mandelbrot loops.

The method is to multiply an artifical variable, ONE, which will be known to
the compiler to be 1 only at runtime. The whole expression is then represented
as a polynomial with respective to ONE. In the coefficients of all terms, only one a
and one b should appear

err = (a + b) * ONE^6 - a * ONE^5 - (a + b) * ONE^4 + a * ONE^3 - b - (a + b) * ONE^2 + a * ONE
*/

float prevent_fp64_optimization(float value) {
#if defined(LUMA_FP64_CODE_ELIMINATION_WORKAROUND)
  return value + fp64.ONE * 0.0;
#else
  return value;
#endif
}

// Divide float number to high and low floats to extend fraction bits
vec2 split(float a) {
  // Keep SPLIT as a runtime uniform so the compiler cannot fold the Dekker
  // split into a constant expression and reassociate the recovery steps.
  float split = prevent_fp64_optimization(fp64.SPLIT);
  float t = prevent_fp64_optimization(a * split);
  float temp = t - a;
  float a_hi = t - temp;
  float a_lo = a - a_hi;
  return vec2(a_hi, a_lo);
}

// Divide float number again when high float uses too many fraction bits
vec2 split2(vec2 a) {
  vec2 b = split(a.x);
  b.y += a.y;
  return b;
}

// Special sum operation when a > b
vec2 quickTwoSum(float a, float b) {
#if defined(LUMA_FP64_CODE_ELIMINATION_WORKAROUND)
  float sum = (a + b) * fp64.ONE;
  float err = b - (sum - a) * fp64.ONE;
#else
  float sum = a + b;
  float err = b - (sum - a);
#endif
  return vec2(sum, err);
}

// General sum operation
vec2 twoSum(float a, float b) {
  float s = (a + b);
#if defined(LUMA_FP64_CODE_ELIMINATION_WORKAROUND)
  float v = (s * fp64.ONE - a) * fp64.ONE;
  float err = (a - (s - v) * fp64.ONE) * fp64.ONE * fp64.ONE * fp64.ONE + (b - v);
#else
  float v = s - a;
  float err = (a - (s - v)) + (b - v);
#endif
  return vec2(s, err);
}

vec2 twoSub(float a, float b) {
  float s = (a - b);
#if defined(LUMA_FP64_CODE_ELIMINATION_WORKAROUND)
  float v = (s * fp64.ONE - a) * fp64.ONE;
  float err = (a - (s - v) * fp64.ONE) * fp64.ONE * fp64.ONE * fp64.ONE - (b + v);
#else
  float v = s - a;
  float err = (a - (s - v)) - (b + v);
#endif
  return vec2(s, err);
}

vec2 twoSqr(float a) {
  float prod = a * a;
  vec2 a_fp64 = split(a);
#if defined(LUMA_FP64_CODE_ELIMINATION_WORKAROUND)
  float err = ((a_fp64.x * a_fp64.x - prod) * fp64.ONE + 2.0 * a_fp64.x *
    a_fp64.y * fp64.ONE * fp64.ONE) + a_fp64.y * a_fp64.y * fp64.ONE * fp64.ONE * fp64.ONE;
#else
  float err = ((a_fp64.x * a_fp64.x - prod) + 2.0 * a_fp64.x * a_fp64.y) + a_fp64.y * a_fp64.y;
#endif
  return vec2(prod, err);
}

vec2 twoProd(float a, float b) {
  float prod = a * b;
  vec2 a_fp64 = split(a);
  vec2 b_fp64 = split(b);
  // twoProd is especially sensitive because mul_fp64 and div_fp64 both depend
  // on the split terms and cross terms staying in the original evaluation
  // order. If the compiler folds or reassociates them, the low part tends to
  // collapse to zero or NaN on some drivers.
  float highProduct = prevent_fp64_optimization(a_fp64.x * b_fp64.x);
  float crossProduct1 = prevent_fp64_optimization(a_fp64.x * b_fp64.y);
  float crossProduct2 = prevent_fp64_optimization(a_fp64.y * b_fp64.x);
  float lowProduct = prevent_fp64_optimization(a_fp64.y * b_fp64.y);
#if defined(LUMA_FP64_CODE_ELIMINATION_WORKAROUND)
  float err1 = (highProduct - prod) * fp64.ONE;
  float err2 = crossProduct1 * fp64.ONE * fp64.ONE;
  float err3 = crossProduct2 * fp64.ONE * fp64.ONE * fp64.ONE;
  float err4 = lowProduct * fp64.ONE * fp64.ONE * fp64.ONE * fp64.ONE;
#else
  float err1 = highProduct - prod;
  float err2 = crossProduct1;
  float err3 = crossProduct2;
  float err4 = lowProduct;
#endif
  float err = ((err1 + err2) + err3) + err4;
  return vec2(prod, err);
}

vec2 sum_fp64(vec2 a, vec2 b) {
  vec2 s, t;
  s = twoSum(a.x, b.x);
  t = twoSum(a.y, b.y);
  s.y += t.x;
  s = quickTwoSum(s.x, s.y);
  s.y += t.y;
  s = quickTwoSum(s.x, s.y);
  return s;
}

vec2 sub_fp64(vec2 a, vec2 b) {
  vec2 s, t;
  s = twoSub(a.x, b.x);
  t = twoSub(a.y, b.y);
  s.y += t.x;
  s = quickTwoSum(s.x, s.y);
  s.y += t.y;
  s = quickTwoSum(s.x, s.y);
  return s;
}

vec2 mul_fp64(vec2 a, vec2 b) {
  vec2 prod = twoProd(a.x, b.x);
  // y component is for the error
  prod.y += a.x * b.y;
#if defined(LUMA_FP64_HIGH_BITS_OVERFLOW_WORKAROUND)
  prod = split2(prod);
#endif
  prod = quickTwoSum(prod.x, prod.y);
  prod.y += a.y * b.x;
#if defined(LUMA_FP64_HIGH_BITS_OVERFLOW_WORKAROUND)
  prod = split2(prod);
#endif
  prod = quickTwoSum(prod.x, prod.y);
  return prod;
}

vec2 div_fp64(vec2 a, vec2 b) {
  float xn = 1.0 / b.x;
#if defined(LUMA_FP64_HIGH_BITS_OVERFLOW_WORKAROUND)
  vec2 yn = mul_fp64(a, vec2(xn, 0));
#else
  vec2 yn = a * xn;
#endif
  float diff = (sub_fp64(a, mul_fp64(b, yn))).x;
  vec2 prod = twoProd(xn, diff);
  return sum_fp64(yn, prod);
}

vec2 sqrt_fp64(vec2 a) {
  if (a.x == 0.0 && a.y == 0.0) return vec2(0.0, 0.0);
  if (a.x < 0.0) return vec2(0.0 / 0.0, 0.0 / 0.0);

  float x = 1.0 / sqrt(a.x);
  float yn = a.x * x;
#if defined(LUMA_FP64_CODE_ELIMINATION_WORKAROUND)
  vec2 yn_sqr = twoSqr(yn) * fp64.ONE;
#else
  vec2 yn_sqr = twoSqr(yn);
#endif
  float diff = sub_fp64(a, yn_sqr).x;
  vec2 prod = twoProd(x * 0.5, diff);
#if defined(LUMA_FP64_HIGH_BITS_OVERFLOW_WORKAROUND)
  return sum_fp64(split(yn), prod);
#else
  return sum_fp64(vec2(yn, 0.0), prod);
#endif
}
`,Z2=`struct Fp64F32Bits {
  sign: u32,
  baseExponent: i32,
  significand: u32,
  isZero: bool,
  isInf: bool,
  isNan: bool,
};

// Decode an f32 as (-1)^sign * significand * 2^baseExponent.
fn fp64_decode_f32_bits(bits: u32) -> Fp64F32Bits {
  let sign = bits >> 31u;
  let exponentBits = (bits >> 23u) & 0xffu;
  let fraction = bits & 0x7fffffu;

  if (exponentBits == 0xffu) {
    return Fp64F32Bits(sign, 0, 0u, false, fraction == 0u, fraction != 0u);
  }
  if (exponentBits == 0u) {
    return Fp64F32Bits(sign, -149, fraction, fraction == 0u, false, false);
  }
  return Fp64F32Bits(sign, i32(exponentBits) - 150, 0x800000u | fraction, false, false, false);
}

fn fp64_f32_magnitude_compare(aBits: u32, bBits: u32) -> i32 {
  let aMagnitude = aBits & 0x7fffffffu;
  let bMagnitude = bBits & 0x7fffffffu;
  if (aMagnitude == bMagnitude) {
    return 0;
  }
  return select(-1, 1, aMagnitude > bMagnitude);
}

fn fp64_make_residual_f32_bits(
  exactSign: u32,
  exactMagnitude: vec2u,
  exactBaseExponent: i32,
  highBits: u32
) -> u32 {
  if (fp64_u64_is_zero(exactMagnitude)) {
    return 0u;
  }

  let high = fp64_decode_f32_bits(highBits);
  if (high.isInf || high.isNan) {
    return exactSign << 31u;
  }
  if (high.isZero) {
    return fp64_make_f32_bits_from_u64(exactSign, exactMagnitude, exactBaseExponent);
  }

  let commonBaseExponent = min(exactBaseExponent, high.baseExponent);
  let exactShift = exactBaseExponent - commonBaseExponent;
  let highShift = high.baseExponent - commonBaseExponent;

  // A normal two-sum/two-product residual never needs a shift this large.
  // This guard gives deterministic underflow behavior outside that contract.
  if (exactShift >= 64 || highShift >= 64) {
    return exactSign << 31u;
  }

  let exactAligned = fp64_u64_shift_left(exactMagnitude, u32(exactShift));
  let highAligned = fp64_u64_shift_left(vec2u(0u, high.significand), u32(highShift));
  let comparison = fp64_u64_compare(exactAligned, highAligned);
  if (comparison == 0) {
    return 0u;
  }

  var residualSign = exactSign;
  var residualMagnitude: vec2u;
  if (comparison > 0) {
    residualMagnitude = fp64_u64_sub(exactAligned, highAligned);
  } else {
    residualSign = exactSign ^ 1u;
    residualMagnitude = fp64_u64_sub(highAligned, exactAligned);
  }
  return fp64_make_f32_bits_from_u64(
    residualSign,
    residualMagnitude,
    commonBaseExponent
  );
}

fn fp64_split_accumulator_bits(
  sign: u32,
  magnitude: vec2u,
  baseExponent: i32
) -> vec2u {
  let highBits = fp64_make_f32_bits_from_u64(sign, magnitude, baseExponent);
  let lowBits = fp64_make_residual_f32_bits(sign, magnitude, baseExponent, highBits);
  return vec2u(highBits, lowBits);
}

fn fp64_two_sum_integer_bits(aBits: u32, bBits: u32) -> vec2u {
  let a = fp64_decode_f32_bits(aBits);
  let b = fp64_decode_f32_bits(bBits);

  if (a.isNan || b.isNan) {
    return vec2u(0x7fc00000u, 0u);
  }
  if (a.isInf || b.isInf) {
    if (a.isInf && b.isInf && a.sign != b.sign) {
      return vec2u(0x7fc00000u, 0u);
    }
    return select(vec2u(bBits, 0u), vec2u(aBits, 0u), a.isInf);
  }
  if (a.isZero && b.isZero) {
    return vec2u((a.sign & b.sign) << 31u, 0u);
  }
  if (a.isZero) {
    return vec2u(bBits, 0u);
  }
  if (b.isZero) {
    return vec2u(aBits, 0u);
  }

  let exponentDifference = select(
    b.baseExponent - a.baseExponent,
    a.baseExponent - b.baseExponent,
    a.baseExponent >= b.baseExponent
  );

  // Beyond half an ulp, rounding cannot change the larger operand. Returning
  // the smaller operand intact also avoids an unbounded integer alignment.
  // At a power-of-two boundary the spacing below the larger operand is half
  // the spacing above it, so an opposite-sign gap-25 operand can still change
  // the rounded high limb. Gap 26 is the first universally safe early-out.
  if (exponentDifference > 25) {
    if (fp64_f32_magnitude_compare(aBits, bBits) >= 0) {
      return vec2u(aBits, bBits);
    }
    return vec2u(bBits, aBits);
  }

  let commonBaseExponent = min(a.baseExponent, b.baseExponent);
  let aMagnitude = fp64_u64_shift_left(
    vec2u(0u, a.significand),
    u32(a.baseExponent - commonBaseExponent)
  );
  let bMagnitude = fp64_u64_shift_left(
    vec2u(0u, b.significand),
    u32(b.baseExponent - commonBaseExponent)
  );

  var resultSign = a.sign;
  var resultMagnitude: vec2u;
  if (a.sign == b.sign) {
    resultMagnitude = fp64_u64_add(aMagnitude, bMagnitude);
  } else {
    let comparison = fp64_u64_compare(aMagnitude, bMagnitude);
    if (comparison == 0) {
      return vec2u(0u, 0u);
    }
    if (comparison > 0) {
      resultMagnitude = fp64_u64_sub(aMagnitude, bMagnitude);
    } else {
      resultSign = b.sign;
      resultMagnitude = fp64_u64_sub(bMagnitude, aMagnitude);
    }
  }

  return fp64_split_accumulator_bits(resultSign, resultMagnitude, commonBaseExponent);
}

fn fp64_two_sum_integer(a: f32, b: f32) -> vec2f {
  let resultBits = fp64_two_sum_integer_bits(bitcast<u32>(a), bitcast<u32>(b));
  return vec2f(bitcast<f32>(resultBits.x), bitcast<f32>(resultBits.y));
}

fn fp64_multiply_significands(a: u32, b: u32) -> vec2u {
  let aLow = a & 0xffffu;
  let aHigh = a >> 16u;
  let bLow = b & 0xffffu;
  let bHigh = b >> 16u;
  let lowProduct = aLow * bLow;
  let crossProduct = aLow * bHigh + aHigh * bLow;
  let highProduct = aHigh * bHigh;

  var result = vec2u(0u, lowProduct);
  result = fp64_u64_add(
    result,
    fp64_u64_shift_left(vec2u(0u, crossProduct), 16u)
  );
  result = fp64_u64_add(result, vec2u(highProduct, 0u));
  return result;
}

fn fp64_two_prod_integer_bits(aBits: u32, bBits: u32) -> vec2u {
  let a = fp64_decode_f32_bits(aBits);
  let b = fp64_decode_f32_bits(bBits);
  let resultSign = a.sign ^ b.sign;

  if (a.isNan || b.isNan || ((a.isZero || b.isZero) && (a.isInf || b.isInf))) {
    return vec2u(0x7fc00000u, 0u);
  }
  if (a.isInf || b.isInf) {
    return vec2u((resultSign << 31u) | 0x7f800000u, resultSign << 31u);
  }
  if (a.isZero || b.isZero) {
    return vec2u(resultSign << 31u, resultSign << 31u);
  }

  let magnitude = fp64_multiply_significands(a.significand, b.significand);
  return fp64_split_accumulator_bits(
    resultSign,
    magnitude,
    a.baseExponent + b.baseExponent
  );
}

fn fp64_two_prod_integer(a: f32, b: f32) -> vec2f {
  let resultBits = fp64_two_prod_integer_bits(bitcast<u32>(a), bitcast<u32>(b));
  return vec2f(bitcast<f32>(resultBits.x), bitcast<f32>(resultBits.y));
}

fn fp64_round_add_integer(a: f32, b: f32) -> f32 {
  return fp64_two_sum_integer(a, b).x;
}

fn fp64_round_mul_integer(a: f32, b: f32) -> f32 {
  return fp64_two_prod_integer(a, b).x;
}

#ifndef LUMA_FP64_PREDICATE_ONLY
fn fp64_f32_finite_exponent(value: Fp64F32Bits) -> i32 {
  let mostSignificantBit = 31u - countLeadingZeros(value.significand);
  return value.baseExponent + i32(mostSignificantBit);
}

fn fp64_scale_f32_integer(value: f32, exponent: i32) -> f32 {
  let decoded = fp64_decode_f32_bits(bitcast<u32>(value));
  if (decoded.isZero || decoded.isInf || decoded.isNan) {
    return value;
  }
  let resultBits = fp64_make_f32_bits_from_u64(
    decoded.sign,
    vec2u(0u, decoded.significand),
    decoded.baseExponent + exponent
  );
  return bitcast<f32>(resultBits);
}

// Divide normalized significands so the hardware operation cannot overflow,
// underflow, or flush a subnormal result. Reapply the exponent with integer
// packing, which also produces subnormal correction limbs without relying on
// floating-point arithmetic to preserve them.
fn fp64_divide_f32_integer(aValue: f32, bValue: f32) -> f32 {
  let a = fp64_decode_f32_bits(bitcast<u32>(aValue));
  let b = fp64_decode_f32_bits(bitcast<u32>(bValue));
  if (a.isZero || b.isZero || a.isInf || b.isInf || a.isNan || b.isNan) {
    return aValue / bValue;
  }

  let aMostSignificantBit = 31u - countLeadingZeros(a.significand);
  let bMostSignificantBit = 31u - countLeadingZeros(b.significand);
  let normalizedABits = fp64_make_f32_bits_from_u64(
    a.sign,
    vec2u(0u, a.significand),
    -i32(aMostSignificantBit)
  );
  let normalizedBBits = fp64_make_f32_bits_from_u64(
    b.sign,
    vec2u(0u, b.significand),
    -i32(bMostSignificantBit)
  );
  let normalizedQuotient = bitcast<f32>(normalizedABits) / bitcast<f32>(normalizedBBits);
  let quotient = fp64_decode_f32_bits(bitcast<u32>(normalizedQuotient));
  let exponentShift =
    a.baseExponent + i32(aMostSignificantBit) -
    b.baseExponent - i32(bMostSignificantBit);
  let quotientBits = fp64_make_f32_bits_from_u64(
    quotient.sign,
    vec2u(0u, quotient.significand),
    quotient.baseExponent + exponentShift
  );
  return bitcast<f32>(quotientBits);
}
#endif

#ifndef LUMA_FP64_PREDICATE_ONLY
fn split(a: f32) -> vec2f {
  let aBits = bitcast<u32>(a);
  let decoded = fp64_decode_f32_bits(aBits);
  if (decoded.isZero || decoded.isInf || decoded.isNan) {
    return vec2f(a, 0.0);
  }

  var roundedHigh = decoded.significand >> 12u;
  let remainder = decoded.significand & 0xfffu;
  if (remainder > 0x800u || (remainder == 0x800u && (roundedHigh & 1u) == 1u)) {
    roundedHigh = roundedHigh + 1u;
  }
  var highMagnitude = vec2u(0u, roundedHigh << 12u);
  var highBits = fp64_make_f32_bits_from_u64(
    decoded.sign,
    highMagnitude,
    decoded.baseExponent
  );
  // Rounding the high limb of a maximum-exponent value can overflow even
  // though the original value is finite. Truncate only in that boundary case
  // so split remains an exact finite decomposition.
  if (fp64_decode_f32_bits(highBits).isInf) {
    roundedHigh = decoded.significand >> 12u;
    highMagnitude = vec2u(0u, roundedHigh << 12u);
    highBits = fp64_make_f32_bits_from_u64(
      decoded.sign,
      highMagnitude,
      decoded.baseExponent
    );
  }
  let lowBits = fp64_make_residual_f32_bits(
    decoded.sign,
    vec2u(0u, decoded.significand),
    decoded.baseExponent,
    highBits
  );
  return vec2f(bitcast<f32>(highBits), bitcast<f32>(lowBits));
}

fn split2(a: vec2f) -> vec2f {
  var result = split(a.x);
  result.y = fp64_round_add_integer(result.y, a.y);
  return result;
}
#endif

#ifndef LUMA_FP64_PREDICATE_ONLY
fn quickTwoSum(a: f32, b: f32) -> vec2f {
  return fp64_two_sum_integer(a, b);
}
#endif

fn twoSum(a: f32, b: f32) -> vec2f {
  return fp64_two_sum_integer(a, b);
}

fn twoSub(a: f32, b: f32) -> vec2f {
  let bBits = bitcast<u32>(b) ^ 0x80000000u;
  let resultBits = fp64_two_sum_integer_bits(bitcast<u32>(a), bBits);
  return vec2f(bitcast<f32>(resultBits.x), bitcast<f32>(resultBits.y));
}

#ifndef LUMA_FP64_PREDICATE_ONLY
fn twoSqr(a: f32) -> vec2f {
  return fp64_two_prod_integer(a, a);
}

fn twoProd(a: f32, b: f32) -> vec2f {
  return fp64_two_prod_integer(a, b);
}
#endif

fn sum_fp64(a: vec2f, b: vec2f) -> vec2f {
  var sum = fp64_two_sum_integer(a.x, b.x);
  let lowSum = fp64_two_sum_integer(a.y, b.y);
  sum.y = fp64_round_add_integer(sum.y, lowSum.x);
  sum = fp64_two_sum_integer(sum.x, sum.y);
  sum.y = fp64_round_add_integer(sum.y, lowSum.y);
  return fp64_two_sum_integer(sum.x, sum.y);
}

fn sub_fp64(a: vec2f, b: vec2f) -> vec2f {
  let negatedB = vec2f(
    bitcast<f32>(bitcast<u32>(b.x) ^ 0x80000000u),
    bitcast<f32>(bitcast<u32>(b.y) ^ 0x80000000u)
  );
  return sum_fp64(a, negatedB);
}

fn mul_fp64(a: vec2f, b: vec2f) -> vec2f {
  var product = fp64_two_prod_integer(a.x, b.x);
  let crossProduct1 = fp64_round_mul_integer(a.x, b.y);
  product.y = fp64_round_add_integer(product.y, crossProduct1);
  product = fp64_two_sum_integer(product.x, product.y);
  let crossProduct2 = fp64_round_mul_integer(a.y, b.x);
  product.y = fp64_round_add_integer(product.y, crossProduct2);
  return fp64_two_sum_integer(product.x, product.y);
}

#ifndef LUMA_FP64_PREDICATE_ONLY
fn fp64_scale_fp64_integer(value: vec2f, exponent: i32) -> vec2f {
  let high = fp64_scale_f32_integer(value.x, exponent);
  let low = fp64_scale_f32_integer(value.y, exponent);
  return sum_fp64(vec2f(high, 0.0), vec2f(low, 0.0));
}

fn fp64_div_fp64_normalized(a: vec2f, b: vec2f) -> vec2f {
  let quotientHigh = fp64_divide_f32_integer(a.x, b.x);
  var quotient = vec2f(quotientHigh, 0.0);

  let remainder = sub_fp64(a, mul_fp64(b, quotient));
  let quotientLow = fp64_divide_f32_integer(remainder.x, b.x);
  quotient = sum_fp64(quotient, vec2f(quotientLow, 0.0));

  let secondRemainder = sub_fp64(a, mul_fp64(b, quotient));
  let correction = fp64_divide_f32_integer(secondRemainder.x, b.x);
  return sum_fp64(quotient, vec2f(correction, 0.0));
}

fn div_fp64(a: vec2f, b: vec2f) -> vec2f {
  let decodedA = fp64_decode_f32_bits(bitcast<u32>(a.x));
  let decodedB = fp64_decode_f32_bits(bitcast<u32>(b.x));
  if (
    decodedA.isZero || decodedB.isZero ||
    decodedA.isInf || decodedB.isInf ||
    decodedA.isNan || decodedB.isNan
  ) {
    return fp64_div_fp64_normalized(a, b);
  }

  let exponentA = fp64_f32_finite_exponent(decodedA);
  let exponentB = fp64_f32_finite_exponent(decodedB);
  // Correct the quotient near unity so b * q and the remainder stay clear of
  // both f32 underflow and overflow. The exponent difference is applied once.
  let normalizedA = fp64_scale_fp64_integer(a, -exponentA);
  let normalizedB = fp64_scale_fp64_integer(b, -exponentB);
  let normalizedQuotient = fp64_div_fp64_normalized(normalizedA, normalizedB);
  return fp64_scale_fp64_integer(normalizedQuotient, exponentA - exponentB);
}

fn fp64_sqrt_fp64_normalized(a: vec2f) -> vec2f {
  let estimate = sqrt(a.x);
  let difference = sub_fp64(a, fp64_two_prod_integer(estimate, estimate)).x;
  let denominator = fp64_round_add_integer(estimate, estimate);
  let correction = fp64_divide_f32_integer(difference, denominator);
  return sum_fp64(vec2f(estimate, 0.0), vec2f(correction, 0.0));
}

fn sqrt_fp64(a: vec2f) -> vec2f {
  let decoded = fp64_decode_f32_bits(bitcast<u32>(a.x));
  let decodedLow = fp64_decode_f32_bits(bitcast<u32>(a.y));
  if (decoded.isZero && decodedLow.isZero) {
    return vec2f(0.0, 0.0);
  }
  if (decoded.sign == 1u) {
    let nanValue = fp64_nan(a.x);
    return vec2f(nanValue, nanValue);
  }

  if (decoded.isInf || decoded.isNan) {
    return fp64_sqrt_fp64_normalized(a);
  }
  let exponent = fp64_f32_finite_exponent(decoded);
  // An even scale lets the final square-root rescale use an integer exponent.
  let evenExponent = exponent - (exponent & 1);
  let normalizedA = fp64_scale_fp64_integer(a, -evenExponent);
  let normalizedRoot = fp64_sqrt_fp64_normalized(normalizedA);
  return fp64_scale_fp64_integer(normalizedRoot, evenExponent / 2);
}
#endif
`,X2=`struct Fp64ArithmeticUniforms {
  ONE: f32,
  SPLIT: f32,
};

@group(0) @binding(auto) var<uniform> fp64arithmetic : Fp64ArithmeticUniforms;

#ifndef LUMA_FP64_F32_INPUT_ONLY
struct Fp64Bits {
  sign: u32,
  exponent: i32,
  significand: vec2u,
  isZero: bool,
  isInf: bool,
  isNan: bool,
};
#endif

#ifndef LUMA_FP64_PREDICATE_ONLY
fn fp64_nan(seed: f32) -> f32 {
  let nanBits = 0x7fc00000u | select(0u, 1u, seed < 0.0);
  return bitcast<f32>(nanBits);
}
#endif

fn fp64_u64_is_zero(value: vec2u) -> bool {
  return value.x == 0u && value.y == 0u;
}

fn fp64_u64_compare(a: vec2u, b: vec2u) -> i32 {
  if (a.x != b.x) {
    return select(-1, 1, a.x > b.x);
  }
  if (a.y != b.y) {
    return select(-1, 1, a.y > b.y);
  }
  return 0;
}

fn fp64_u64_add(a: vec2u, b: vec2u) -> vec2u {
  let low = a.y + b.y;
  let carry = select(0u, 1u, low < a.y);
  return vec2u(a.x + b.x + carry, low);
}

fn fp64_u64_sub(a: vec2u, b: vec2u) -> vec2u {
  let borrow = select(0u, 1u, a.y < b.y);
  return vec2u(a.x - b.x - borrow, a.y - b.y);
}

fn fp64_u64_shift_left(value: vec2u, shift: u32) -> vec2u {
  if (shift == 0u) {
    return value;
  }
  if (shift < 32u) {
    return vec2u((value.x << shift) | (value.y >> (32u - shift)), value.y << shift);
  }
  if (shift == 32u) {
    return vec2u(value.y, 0u);
  }
  if (shift < 64u) {
    return vec2u(value.y << (shift - 32u), 0u);
  }
  return vec2u(0u);
}

fn fp64_u64_shift_right(value: vec2u, shift: u32) -> vec2u {
  if (shift == 0u) {
    return value;
  }
  if (shift < 32u) {
    return vec2u(value.x >> shift, (value.y >> shift) | (value.x << (32u - shift)));
  }
  if (shift == 32u) {
    return vec2u(0u, value.x);
  }
  if (shift < 64u) {
    return vec2u(0u, value.x >> (shift - 32u));
  }
  return vec2u(0u);
}

fn fp64_u64_get_bit(value: vec2u, bitIndex: u32) -> bool {
  if (bitIndex >= 64u) {
    return false;
  }
  if (bitIndex >= 32u) {
    return ((value.x >> (bitIndex - 32u)) & 1u) != 0u;
  }
  return ((value.y >> bitIndex) & 1u) != 0u;
}

fn fp64_u64_has_bits_below(value: vec2u, bitCount: u32) -> bool {
  if (bitCount == 0u) {
    return false;
  }
  if (bitCount >= 64u) {
    return !fp64_u64_is_zero(value);
  }
  if (bitCount > 32u) {
    let highBitCount = bitCount - 32u;
    let highMask = (1u << highBitCount) - 1u;
    return value.y != 0u || (value.x & highMask) != 0u;
  }
  if (bitCount == 32u) {
    return value.y != 0u;
  }
  let lowMask = (1u << bitCount) - 1u;
  return (value.y & lowMask) != 0u;
}

#ifndef LUMA_FP64_F32_INPUT_ONLY
fn fp64_u64_shift_right_sticky(value: vec2u, shift: u32) -> vec2u {
  var shifted = fp64_u64_shift_right(value, shift);
  if (fp64_u64_has_bits_below(value, shift)) {
    shifted.y = shifted.y | 1u;
  }
  return shifted;
}
#endif

fn fp64_u64_count_leading_zeros(value: vec2u) -> u32 {
  if (value.x != 0u) {
    return countLeadingZeros(value.x);
  }
  return 32u + countLeadingZeros(value.y);
}

fn fp64_round_shift_right_to_u32(value: vec2u, shift: u32) -> u32 {
  if (shift == 0u) {
    return value.y;
  }

  let truncated = fp64_u64_shift_right(value, shift);
  var rounded = truncated.y;
  let guard = fp64_u64_get_bit(value, shift - 1u);
  let hasTrailingBits = fp64_u64_has_bits_below(value, shift - 1u);
  if (guard && (hasTrailingBits || (rounded & 1u) == 1u)) {
    rounded = rounded + 1u;
  }
  return rounded;
}

#ifndef LUMA_FP64_F32_INPUT_ONLY
fn fp64_round_shift_right(value: vec2u, shift: u32) -> vec2u {
  if (shift == 0u) {
    return value;
  }

  var rounded = fp64_u64_shift_right(value, shift);
  let guard = fp64_u64_get_bit(value, shift - 1u);
  let hasTrailingBits = fp64_u64_has_bits_below(value, shift - 1u);
  if (guard && (hasTrailingBits || (rounded.y & 1u) == 1u)) {
    rounded = fp64_u64_add(rounded, vec2u(0u, 1u));
  }
  return rounded;
}
#endif

fn fp64_make_f32_bits_from_u64(sign: u32, significand: vec2u, baseExponent: i32) -> u32 {
  if (fp64_u64_is_zero(significand)) {
    return sign << 31u;
  }

  let leadingZeros = fp64_u64_count_leading_zeros(significand);
  let mostSignificantBit = 63u - leadingZeros;
  var exponent = baseExponent + i32(mostSignificantBit);

  if (exponent > 127) {
    return (sign << 31u) | 0x7f800000u;
  }

  if (exponent >= -126) {
    let shift = i32(mostSignificantBit) - 23;
    var significand24: u32;
    if (shift > 0) {
      significand24 = fp64_round_shift_right_to_u32(significand, u32(shift));
    } else {
      significand24 = fp64_u64_shift_left(significand, u32(-shift)).y;
    }

    if (significand24 >= 0x1000000u) {
      significand24 = significand24 >> 1u;
      exponent = exponent + 1;
      if (exponent > 127) {
        return (sign << 31u) | 0x7f800000u;
      }
    }

    return (sign << 31u) | (u32(exponent + 127) << 23u) | (significand24 & 0x7fffffu);
  }

  let scaleExponent = baseExponent + 149;
  var mantissa: u32;
  if (scaleExponent >= 0) {
    mantissa = fp64_u64_shift_left(significand, u32(scaleExponent)).y;
  } else {
    mantissa = fp64_round_shift_right_to_u32(significand, u32(-scaleExponent));
  }

  if (mantissa >= 0x800000u) {
    return (sign << 31u) | 0x00800000u;
  }
  return (sign << 31u) | mantissa;
}

#ifndef LUMA_FP64_F32_INPUT_ONLY
fn fp64_decode_bits(bits: vec2u) -> Fp64Bits {
  let sign = bits.x >> 31u;
  let exponentBits = (bits.x >> 20u) & 0x7ffu;
  let fractionHigh = bits.x & 0xfffffu;
  let fractionLow = bits.y;
  let fraction = vec2u(fractionHigh, fractionLow);

  if (exponentBits == 0x7ffu) {
    let isInf = fp64_u64_is_zero(fraction);
    return Fp64Bits(sign, 0, vec2u(0u), false, isInf, !isInf);
  }

  if (exponentBits == 0u) {
    let isZero = fp64_u64_is_zero(fraction);
    return Fp64Bits(sign, -1022, fraction, isZero, false, false);
  }

  return Fp64Bits(sign, i32(exponentBits) - 1023, vec2u((1u << 20u) | fractionHigh, fractionLow), false, false, false);
}

fn fp64_finite_magnitude_compare(a: Fp64Bits, b: Fp64Bits) -> i32 {
  if (a.exponent != b.exponent) {
    return select(-1, 1, a.exponent > b.exponent);
  }
  return fp64_u64_compare(a.significand, b.significand);
}
#endif

#ifndef LUMA_FP64_F32_INPUT_ONLY
struct Fp64RawF32Bits {
  sign: u32,
  baseExponent: i32,
  significand: u32,
  isZero: bool,
  isInf: bool,
  isNan: bool,
};

// Decode an f32 as (-1)^sign * significand * 2^baseExponent. This shared
// integer representation lets normalization remain independent of the
// selected double-single arithmetic implementation.
fn fp64_decode_raw_f32_bits(bits: u32) -> Fp64RawF32Bits {
  let sign = bits >> 31u;
  let exponentBits = (bits >> 23u) & 0xffu;
  let fraction = bits & 0x7fffffu;

  if (exponentBits == 0xffu) {
    return Fp64RawF32Bits(sign, 0, 0u, false, fraction == 0u, fraction != 0u);
  }
  if (exponentBits == 0u) {
    return Fp64RawF32Bits(sign, -149, fraction, fraction == 0u, false, false);
  }
  return Fp64RawF32Bits(
    sign,
    i32(exponentBits) - 150,
    0x800000u | fraction,
    false,
    false,
    false
  );
}

fn fp64_raw_f32_magnitude_compare(aBits: u32, bBits: u32) -> i32 {
  let aMagnitude = aBits & 0x7fffffffu;
  let bMagnitude = bBits & 0x7fffffffu;
  if (aMagnitude == bMagnitude) {
    return 0;
  }
  return select(-1, 1, aMagnitude > bMagnitude);
}

fn fp64_make_raw_residual_f32_bits(
  exactSign: u32,
  exactMagnitude: vec2u,
  exactBaseExponent: i32,
  highBits: u32
) -> u32 {
  if (fp64_u64_is_zero(exactMagnitude)) {
    return 0u;
  }

  let high = fp64_decode_raw_f32_bits(highBits);
  if (high.isInf || high.isNan) {
    return 0u;
  }
  if (high.isZero) {
    return fp64_make_f32_bits_from_u64(exactSign, exactMagnitude, exactBaseExponent);
  }

  let commonBaseExponent = min(exactBaseExponent, high.baseExponent);
  let exactShift = exactBaseExponent - commonBaseExponent;
  let highShift = high.baseExponent - commonBaseExponent;
  if (exactShift >= 64 || highShift >= 64) {
    return 0u;
  }

  let exactAligned = fp64_u64_shift_left(exactMagnitude, u32(exactShift));
  let highAligned = fp64_u64_shift_left(vec2u(0u, high.significand), u32(highShift));
  let comparison = fp64_u64_compare(exactAligned, highAligned);
  if (comparison == 0) {
    return 0u;
  }

  var residualSign = exactSign;
  var residualMagnitude: vec2u;
  if (comparison > 0) {
    residualMagnitude = fp64_u64_sub(exactAligned, highAligned);
  } else {
    residualSign = exactSign ^ 1u;
    residualMagnitude = fp64_u64_sub(highAligned, exactAligned);
  }
  return fp64_make_f32_bits_from_u64(
    residualSign,
    residualMagnitude,
    commonBaseExponent
  );
}

fn fp64_split_raw_accumulator_bits(
  sign: u32,
  magnitude: vec2u,
  baseExponent: i32
) -> vec2u {
  if (fp64_u64_is_zero(magnitude)) {
    return vec2u(0u);
  }
  let highBits = fp64_make_f32_bits_from_u64(sign, magnitude, baseExponent);
  let rawLowBits = fp64_make_raw_residual_f32_bits(sign, magnitude, baseExponent, highBits);
  let lowBits = select(rawLowBits, 0u, (rawLowBits & 0x7fffffffu) == 0u);
  if ((highBits & 0x7fffffffu) == 0u && (lowBits & 0x7fffffffu) == 0u) {
    return vec2u(0u);
  }
  return vec2u(highBits, lowBits);
}
#endif

#ifndef LUMA_FP64_F32_INPUT_ONLY
// Round an arithmetic accumulator to binary64 before splitting it. The
// aligned add/subtract paths retain three guard bits plus a sticky bit, which
// is sufficient for round-to-nearest-even at the binary64 boundary.
fn fp64_split_binary64_accumulator_bits(
  sign: u32,
  magnitude: vec2u,
  baseExponent: i32
) -> vec2u {
  if (fp64_u64_is_zero(magnitude)) {
    return vec2u(0u);
  }

  let mostSignificantBit = 63u - fp64_u64_count_leading_zeros(magnitude);
  let exponent = baseExponent + i32(mostSignificantBit);
  if (exponent > 1023) {
    return vec2u((sign << 31u) | 0x7f800000u, 0u);
  }

  var roundedMagnitude = magnitude;
  var roundedBaseExponent = baseExponent;
  if (exponent >= -1022) {
    if (mostSignificantBit > 52u) {
      let shift = mostSignificantBit - 52u;
      roundedMagnitude = fp64_round_shift_right(magnitude, shift);
      roundedBaseExponent = baseExponent + i32(shift);
    }
  } else {
    let shift = -1074 - baseExponent;
    if (shift > 0) {
      roundedMagnitude = fp64_round_shift_right(magnitude, u32(shift));
      roundedBaseExponent = -1074;
    }
  }

  if (fp64_u64_is_zero(roundedMagnitude)) {
    return vec2u(0u);
  }
  return fp64_split_raw_accumulator_bits(sign, roundedMagnitude, roundedBaseExponent);
}
#endif

#ifndef LUMA_FP64_PREDICATE_ONLY
fn fp64_add_raw_f32_bits(aBits: u32, bBits: u32) -> vec2u {
  let a = fp64_decode_raw_f32_bits(aBits);
  let b = fp64_decode_raw_f32_bits(bBits);

  if (a.isNan || b.isNan) {
    return vec2u(0x7fc00000u, 0u);
  }
  if (a.isInf || b.isInf) {
    if (a.isInf && b.isInf && a.sign != b.sign) {
      return vec2u(0x7fc00000u, 0u);
    }
    return select(vec2u(bBits, 0u), vec2u(aBits, 0u), a.isInf);
  }
  if (a.isZero && b.isZero) {
    return vec2u(0u);
  }
  if (a.isZero) {
    return vec2u(bBits, 0u);
  }
  if (b.isZero) {
    return vec2u(aBits, 0u);
  }

  let exponentDifference = abs(a.baseExponent - b.baseExponent);
  if (exponentDifference > 25) {
    if (fp64_raw_f32_magnitude_compare(aBits, bBits) >= 0) {
      return vec2u(aBits, bBits);
    }
    return vec2u(bBits, aBits);
  }

  let commonBaseExponent = min(a.baseExponent, b.baseExponent);
  let aMagnitude = fp64_u64_shift_left(
    vec2u(0u, a.significand),
    u32(a.baseExponent - commonBaseExponent)
  );
  let bMagnitude = fp64_u64_shift_left(
    vec2u(0u, b.significand),
    u32(b.baseExponent - commonBaseExponent)
  );

  var resultSign = a.sign;
  var resultMagnitude: vec2u;
  if (a.sign == b.sign) {
    resultMagnitude = fp64_u64_add(aMagnitude, bMagnitude);
  } else {
    let comparison = fp64_u64_compare(aMagnitude, bMagnitude);
    if (comparison == 0) {
      return vec2u(0u);
    }
    if (comparison > 0) {
      resultMagnitude = fp64_u64_sub(aMagnitude, bMagnitude);
    } else {
      resultSign = b.sign;
      resultMagnitude = fp64_u64_sub(bMagnitude, aMagnitude);
    }
  }

  return fp64_split_raw_accumulator_bits(
    resultSign,
    resultMagnitude,
    commonBaseExponent
  );
}
#endif

#ifndef LUMA_FP64_F32_INPUT_ONLY
fn fp64_add_aligned_magnitudes_to_fp64_bits(
  sign: u32,
  larger: Fp64Bits,
  smaller: Fp64Bits
) -> vec2u {
  let largeSignificand = fp64_u64_shift_left(larger.significand, 3u);
  let smallSignificand = fp64_u64_shift_right_sticky(
    fp64_u64_shift_left(smaller.significand, 3u),
    u32(larger.exponent - smaller.exponent)
  );
  let resultSignificand = fp64_u64_add(largeSignificand, smallSignificand);
  return fp64_split_binary64_accumulator_bits(
    sign,
    resultSignificand,
    larger.exponent - 55
  );
}

fn fp64_sub_aligned_magnitudes_to_fp64_bits(
  sign: u32,
  larger: Fp64Bits,
  smaller: Fp64Bits
) -> vec2u {
  let largeSignificand = fp64_u64_shift_left(larger.significand, 3u);
  let smallSignificand = fp64_u64_shift_right_sticky(
    fp64_u64_shift_left(smaller.significand, 3u),
    u32(larger.exponent - smaller.exponent)
  );
  let resultSignificand = fp64_u64_sub(largeSignificand, smallSignificand);
  return fp64_split_binary64_accumulator_bits(
    sign,
    resultSignificand,
    larger.exponent - 55
  );
}

fn fp64_add_aligned_magnitudes_to_f32_bits(sign: u32, larger: Fp64Bits, smaller: Fp64Bits) -> u32 {
  let largeSignificand = fp64_u64_shift_left(larger.significand, 3u);
  let smallSignificand = fp64_u64_shift_right_sticky(
    fp64_u64_shift_left(smaller.significand, 3u),
    u32(larger.exponent - smaller.exponent)
  );
  let resultSignificand = fp64_u64_add(largeSignificand, smallSignificand);
  return fp64_make_f32_bits_from_u64(sign, resultSignificand, larger.exponent - 55);
}

fn fp64_sub_aligned_magnitudes_to_f32_bits(sign: u32, larger: Fp64Bits, smaller: Fp64Bits) -> u32 {
  let largeSignificand = fp64_u64_shift_left(larger.significand, 3u);
  let smallSignificand = fp64_u64_shift_right_sticky(
    fp64_u64_shift_left(smaller.significand, 3u),
    u32(larger.exponent - smaller.exponent)
  );
  let resultSignificand = fp64_u64_sub(largeSignificand, smallSignificand);
  return fp64_make_f32_bits_from_u64(sign, resultSignificand, larger.exponent - 55);
}

// Subtract two raw binary64 values and round the exact result once to f32.
// The input words are canonical high/low words: .x contains sign/exponent/high
// fraction bits, and .y contains the low 32 fraction bits.
fn sub_fp64u32_to_f32_bits(aBits: vec2u, bBits: vec2u) -> u32 {
  let a = fp64_decode_bits(aBits);
  let b = fp64_decode_bits(bBits);
  let bSubtractionSign = b.sign ^ 1u;

  if (a.isNan || b.isNan) {
    return 0x7fc00000u;
  }
  if (a.isInf && b.isInf) {
    if (a.sign == bSubtractionSign) {
      return (a.sign << 31u) | 0x7f800000u;
    }
    return 0x7fc00000u;
  }
  if (a.isInf) {
    return (a.sign << 31u) | 0x7f800000u;
  }
  if (b.isInf) {
    return (bSubtractionSign << 31u) | 0x7f800000u;
  }
  if (a.isZero && b.isZero) {
    return select(0u, 0x80000000u, a.sign == 1u && b.sign == 0u);
  }

  let magnitudeComparison = fp64_finite_magnitude_compare(a, b);
  if (a.sign == bSubtractionSign) {
    if (magnitudeComparison >= 0) {
      return fp64_add_aligned_magnitudes_to_f32_bits(a.sign, a, b);
    }
    return fp64_add_aligned_magnitudes_to_f32_bits(a.sign, b, a);
  }

  if (magnitudeComparison == 0) {
    return 0u;
  }
  if (magnitudeComparison > 0) {
    return fp64_sub_aligned_magnitudes_to_f32_bits(a.sign, a, b);
  }
  return fp64_sub_aligned_magnitudes_to_f32_bits(bSubtractionSign, b, a);
}

fn sub_fp64u32_to_f32(aBits: vec2u, bBits: vec2u) -> f32 {
  return bitcast<f32>(sub_fp64u32_to_f32_bits(aBits, bBits));
}

// Subtract two raw binary64 values, round once to binary64, then split the
// result into normalized f32 limbs. Finite results must fit within the f32
// exponent range; larger magnitudes map to infinity and smaller magnitudes
// map to zero. The input words use canonical high/low word order.
fn sub_fp64u32_to_fp64_bits(aBits: vec2u, bBits: vec2u) -> vec2u {
  let a = fp64_decode_bits(aBits);
  let b = fp64_decode_bits(bBits);
  let bSubtractionSign = b.sign ^ 1u;

  if (a.isNan || b.isNan) {
    return vec2u(0x7fc00000u, 0u);
  }
  if (a.isInf && b.isInf) {
    if (a.sign == bSubtractionSign) {
      return vec2u((a.sign << 31u) | 0x7f800000u, 0u);
    }
    return vec2u(0x7fc00000u, 0u);
  }
  if (a.isInf) {
    return vec2u((a.sign << 31u) | 0x7f800000u, 0u);
  }
  if (b.isInf) {
    return vec2u((bSubtractionSign << 31u) | 0x7f800000u, 0u);
  }
  if (a.isZero && b.isZero) {
    return vec2u(0u);
  }

  let magnitudeComparison = fp64_finite_magnitude_compare(a, b);
  if (a.sign == bSubtractionSign) {
    if (magnitudeComparison >= 0) {
      return fp64_add_aligned_magnitudes_to_fp64_bits(a.sign, a, b);
    }
    return fp64_add_aligned_magnitudes_to_fp64_bits(a.sign, b, a);
  }

  if (magnitudeComparison == 0) {
    return vec2u(0u);
  }
  if (magnitudeComparison > 0) {
    return fp64_sub_aligned_magnitudes_to_fp64_bits(a.sign, a, b);
  }
  return fp64_sub_aligned_magnitudes_to_fp64_bits(bSubtractionSign, b, a);
}

fn sub_fp64u32_to_fp64(aBits: vec2u, bBits: vec2u) -> vec2f {
  let resultBits = sub_fp64u32_to_fp64_bits(aBits, bBits);
  return vec2f(bitcast<f32>(resultBits.x), bitcast<f32>(resultBits.y));
}
#endif

#ifndef LUMA_FP64_PREDICATE_ONLY
fn fp64_runtime_zero() -> f32 {
  return fp64arithmetic.ONE * 0.0;
}

fn prevent_fp64_optimization(value: f32) -> f32 {
#ifdef LUMA_FP64_CODE_ELIMINATION_WORKAROUND
  return value + fp64_runtime_zero();
#else
  return value;
#endif
}
#endif

#ifdef LUMA_FP64_INTEGER_ARITHMETIC
${Z2}
#else
fn split(a: f32) -> vec2f {
  let splitValue = prevent_fp64_optimization(fp64arithmetic.SPLIT + fp64_runtime_zero());
  let t = prevent_fp64_optimization(a * splitValue);
  let temp = prevent_fp64_optimization(t - a);
  let aHi = prevent_fp64_optimization(t - temp);
  let aLo = prevent_fp64_optimization(a - aHi);
  return vec2f(aHi, aLo);
}

fn split2(a: vec2f) -> vec2f {
  var b = split(a.x);
  b.y = b.y + a.y;
  return b;
}

fn quickTwoSum(a: f32, b: f32) -> vec2f {
#ifdef LUMA_FP64_CODE_ELIMINATION_WORKAROUND
  let sum = prevent_fp64_optimization((a + b) * fp64arithmetic.ONE);
  let err = prevent_fp64_optimization(b - (sum - a) * fp64arithmetic.ONE);
#else
  let sum = prevent_fp64_optimization(a + b);
  let err = prevent_fp64_optimization(b - (sum - a));
#endif
  return vec2f(sum, err);
}

fn twoSum(a: f32, b: f32) -> vec2f {
  let s = prevent_fp64_optimization(a + b);
#ifdef LUMA_FP64_CODE_ELIMINATION_WORKAROUND
  let v = prevent_fp64_optimization((s * fp64arithmetic.ONE - a) * fp64arithmetic.ONE);
  let err =
    prevent_fp64_optimization((a - (s - v) * fp64arithmetic.ONE) *
      fp64arithmetic.ONE *
      fp64arithmetic.ONE *
      fp64arithmetic.ONE) +
    prevent_fp64_optimization(b - v);
#else
  let v = prevent_fp64_optimization(s - a);
  let err = prevent_fp64_optimization(a - (s - v)) + prevent_fp64_optimization(b - v);
#endif
  return vec2f(s, err);
}

fn twoSub(a: f32, b: f32) -> vec2f {
  let s = prevent_fp64_optimization(a - b);
#ifdef LUMA_FP64_CODE_ELIMINATION_WORKAROUND
  let v = prevent_fp64_optimization((s * fp64arithmetic.ONE - a) * fp64arithmetic.ONE);
  let err =
    prevent_fp64_optimization((a - (s - v) * fp64arithmetic.ONE) *
      fp64arithmetic.ONE *
      fp64arithmetic.ONE *
      fp64arithmetic.ONE) -
    prevent_fp64_optimization(b + v);
#else
  let v = prevent_fp64_optimization(s - a);
  let err = prevent_fp64_optimization(a - (s - v)) - prevent_fp64_optimization(b + v);
#endif
  return vec2f(s, err);
}

fn twoSqr(a: f32) -> vec2f {
  let prod = prevent_fp64_optimization(a * a);
  let aFp64 = split(a);
  let highProduct = prevent_fp64_optimization(aFp64.x * aFp64.x);
  let crossProduct = prevent_fp64_optimization(2.0 * aFp64.x * aFp64.y);
  let lowProduct = prevent_fp64_optimization(aFp64.y * aFp64.y);
#ifdef LUMA_FP64_CODE_ELIMINATION_WORKAROUND
  let err =
    (prevent_fp64_optimization(highProduct - prod) * fp64arithmetic.ONE +
      crossProduct * fp64arithmetic.ONE * fp64arithmetic.ONE) +
    lowProduct * fp64arithmetic.ONE * fp64arithmetic.ONE * fp64arithmetic.ONE;
#else
  let err = ((prevent_fp64_optimization(highProduct - prod) + crossProduct) + lowProduct);
#endif
  return vec2f(prod, err);
}

fn twoProd(a: f32, b: f32) -> vec2f {
  let prod = prevent_fp64_optimization(a * b);
  let aFp64 = split(a);
  let bFp64 = split(b);
  let highProduct = prevent_fp64_optimization(aFp64.x * bFp64.x);
  let crossProduct1 = prevent_fp64_optimization(aFp64.x * bFp64.y);
  let crossProduct2 = prevent_fp64_optimization(aFp64.y * bFp64.x);
  let lowProduct = prevent_fp64_optimization(aFp64.y * bFp64.y);
#ifdef LUMA_FP64_CODE_ELIMINATION_WORKAROUND
  let err1 = (highProduct - prod) * fp64arithmetic.ONE;
  let err2 = crossProduct1 * fp64arithmetic.ONE * fp64arithmetic.ONE;
  let err3 = crossProduct2 * fp64arithmetic.ONE * fp64arithmetic.ONE * fp64arithmetic.ONE;
  let err4 =
    lowProduct *
    fp64arithmetic.ONE *
    fp64arithmetic.ONE *
    fp64arithmetic.ONE *
    fp64arithmetic.ONE;
#else
  let err1 = highProduct - prod;
  let err2 = crossProduct1;
  let err3 = crossProduct2;
  let err4 = lowProduct;
#endif
  let err12InputA = prevent_fp64_optimization(err1);
  let err12InputB = prevent_fp64_optimization(err2);
  let err12 = prevent_fp64_optimization(err12InputA + err12InputB);
  let err123InputA = prevent_fp64_optimization(err12);
  let err123InputB = prevent_fp64_optimization(err3);
  let err123 = prevent_fp64_optimization(err123InputA + err123InputB);
  let err1234InputA = prevent_fp64_optimization(err123);
  let err1234InputB = prevent_fp64_optimization(err4);
  let err = prevent_fp64_optimization(err1234InputA + err1234InputB);
  return vec2f(prod, err);
}

fn sum_fp64(a: vec2f, b: vec2f) -> vec2f {
  var s = twoSum(a.x, b.x);
  let t = twoSum(a.y, b.y);
  s.y = prevent_fp64_optimization(s.y + t.x);
  s = quickTwoSum(s.x, s.y);
  s.y = prevent_fp64_optimization(s.y + t.y);
  s = quickTwoSum(s.x, s.y);
  return s;
}

fn sub_fp64(a: vec2f, b: vec2f) -> vec2f {
  var s = twoSub(a.x, b.x);
  let t = twoSub(a.y, b.y);
  s.y = prevent_fp64_optimization(s.y + t.x);
  s = quickTwoSum(s.x, s.y);
  s.y = prevent_fp64_optimization(s.y + t.y);
  s = quickTwoSum(s.x, s.y);
  return s;
}

fn mul_fp64(a: vec2f, b: vec2f) -> vec2f {
  var prod = twoProd(a.x, b.x);
  let crossProduct1 = prevent_fp64_optimization(a.x * b.y);
  prod.y = prevent_fp64_optimization(prod.y + crossProduct1);
#ifdef LUMA_FP64_HIGH_BITS_OVERFLOW_WORKAROUND
  prod = split2(prod);
#endif
  prod = quickTwoSum(prod.x, prod.y);
  let crossProduct2 = prevent_fp64_optimization(a.y * b.x);
  prod.y = prevent_fp64_optimization(prod.y + crossProduct2);
#ifdef LUMA_FP64_HIGH_BITS_OVERFLOW_WORKAROUND
  prod = split2(prod);
#endif
  prod = quickTwoSum(prod.x, prod.y);
  return prod;
}

#ifndef LUMA_FP64_PREDICATE_ONLY
fn div_fp64(a: vec2f, b: vec2f) -> vec2f {
  let xn = prevent_fp64_optimization(1.0 / b.x);
  let yn = mul_fp64(a, vec2f(xn, fp64_runtime_zero()));
  let diff = prevent_fp64_optimization(sub_fp64(a, mul_fp64(b, yn)).x);
  let prod = twoProd(xn, diff);
  return sum_fp64(yn, prod);
}

fn sqrt_fp64(a: vec2f) -> vec2f {
  if (a.x == 0.0 && a.y == 0.0) {
    return vec2f(0.0, 0.0);
  }
  if (a.x < 0.0) {
    let nanValue = fp64_nan(a.x);
    return vec2f(nanValue, nanValue);
  }

  let x = prevent_fp64_optimization(1.0 / sqrt(a.x));
  let yn = prevent_fp64_optimization(a.x * x);
#ifdef LUMA_FP64_CODE_ELIMINATION_WORKAROUND
  let ynSqr = twoSqr(yn) * fp64arithmetic.ONE;
#else
  let ynSqr = twoSqr(yn);
#endif
  let diff = prevent_fp64_optimization(sub_fp64(a, ynSqr).x);
  let prod = twoProd(prevent_fp64_optimization(x * 0.5), diff);
#ifdef LUMA_FP64_HIGH_BITS_OVERFLOW_WORKAROUND
  return sum_fp64(split(yn), prod);
#else
  return sum_fp64(vec2f(yn, 0.0), prod);
#endif
}
#endif
#endif

#ifndef LUMA_FP64_PREDICATE_ONLY
fn fp64_f32_bits_is_nan(bits: u32) -> bool {
  return (bits & 0x7fffffffu) > 0x7f800000u;
}

fn fp64_f32_bits_is_inf(bits: u32) -> bool {
  return (bits & 0x7fffffffu) == 0x7f800000u;
}

fn fp64_compare_f32_bits(aBits: u32, bBits: u32) -> i32 {
  let aMagnitude = aBits & 0x7fffffffu;
  let bMagnitude = bBits & 0x7fffffffu;
  if (aMagnitude == 0u && bMagnitude == 0u) {
    return 0;
  }
  let aSign = aBits >> 31u;
  let bSign = bBits >> 31u;
  if (aSign != bSign) {
    return select(1, -1, aSign == 1u);
  }
  if (aMagnitude == bMagnitude) {
    return 0;
  }
  let magnitudeComparison = select(-1, 1, aMagnitude > bMagnitude);
  return select(magnitudeComparison, -magnitudeComparison, aSign == 1u);
}

// Normalize an arbitrary pair of finite f32 limbs with integer accumulation.
// This is independent of LUMA_FP64_INTEGER_ARITHMETIC and canonicalizes every
// representation of zero to vec2f(+0.0, +0.0).
fn normalize_fp64(value: vec2f) -> vec2f {
  let resultBits = fp64_add_raw_f32_bits(bitcast<u32>(value.x), bitcast<u32>(value.y));
  return vec2f(bitcast<f32>(resultBits.x), bitcast<f32>(resultBits.y));
}

fn is_nan_fp64(value: vec2f) -> bool {
  let normalized = normalize_fp64(value);
  return fp64_f32_bits_is_nan(bitcast<u32>(normalized.x)) ||
    fp64_f32_bits_is_nan(bitcast<u32>(normalized.y));
}

fn is_finite_fp64(value: vec2f) -> bool {
  let normalized = normalize_fp64(value);
  let highBits = bitcast<u32>(normalized.x);
  let lowBits = bitcast<u32>(normalized.y);
  return !fp64_f32_bits_is_nan(highBits) && !fp64_f32_bits_is_nan(lowBits) &&
    !fp64_f32_bits_is_inf(highBits) && !fp64_f32_bits_is_inf(lowBits);
}

// Returns -1, 0, or 1. NaN is unordered and returns 0; call is_nan_fp64 or
// is_finite_fp64 first when 0 must mean a finite zero.
fn sign_fp64(value: vec2f) -> i32 {
  let normalized = normalize_fp64(value);
  let highBits = bitcast<u32>(normalized.x);
  let lowBits = bitcast<u32>(normalized.y);
  if (fp64_f32_bits_is_nan(highBits) || fp64_f32_bits_is_nan(lowBits)) {
    return 0;
  }
  if ((highBits & 0x7fffffffu) != 0u) {
    return select(1, -1, (highBits >> 31u) == 1u);
  }
  if ((lowBits & 0x7fffffffu) != 0u) {
    return select(1, -1, (lowBits >> 31u) == 1u);
  }
  return 0;
}

// Compares double-single values and returns -1, 0, or 1. NaN is unordered
// and returns 0; callers that require equality semantics must first check
// is_nan_fp64 or is_finite_fp64.
fn compare_fp64(a: vec2f, b: vec2f) -> i32 {
  let normalizedA = normalize_fp64(a);
  let normalizedB = normalize_fp64(b);
  let aHighBits = bitcast<u32>(normalizedA.x);
  let aLowBits = bitcast<u32>(normalizedA.y);
  let bHighBits = bitcast<u32>(normalizedB.x);
  let bLowBits = bitcast<u32>(normalizedB.y);
  if (fp64_f32_bits_is_nan(aHighBits) || fp64_f32_bits_is_nan(aLowBits) ||
      fp64_f32_bits_is_nan(bHighBits) || fp64_f32_bits_is_nan(bLowBits)) {
    return 0;
  }
  let highComparison = fp64_compare_f32_bits(aHighBits, bHighBits);
  if (highComparison != 0) {
    return highComparison;
  }
  return fp64_compare_f32_bits(aLowBits, bLowBits);
}
#endif
`,K2={ONE:1,SPLIT:4097},Q2={name:"fp64arithmetic",source:X2,fs:Sf,vs:Sf,defaultUniforms:K2,uniformTypes:{ONE:"f32",SPLIT:"f32"},fp64ify:Cp,fp64LowPart:V2,fp64ifyMatrix4:j2},J2={useByteColors:"f32"},eS={useByteColors:!0},Ef=iS("floatColors"),tS=nS("floatColors");function iS(i){return`layout(std140) uniform ${i}Uniforms {
  float useByteColors;
} ${i};

vec3 ${i}_normalize(vec3 inputColor) {
  return ${i}.useByteColors > 0.5 ? inputColor / 255.0 : inputColor;
}

vec4 ${i}_normalize(vec4 inputColor) {
  return ${i}.useByteColors > 0.5 ? inputColor / 255.0 : inputColor;
}

vec4 ${i}_premultiplyAlpha(vec4 inputColor) {
  return vec4(inputColor.rgb * inputColor.a, inputColor.a);
}

vec4 ${i}_unpremultiplyAlpha(vec4 inputColor) {
  return inputColor.a > 0.0 ? vec4(inputColor.rgb / inputColor.a, inputColor.a) : vec4(0.0);
}

vec4 ${i}_premultiply_alpha(vec4 inputColor) {
  return ${i}_premultiplyAlpha(inputColor);
}

vec4 ${i}_unpremultiply_alpha(vec4 inputColor) {
  return ${i}_unpremultiplyAlpha(inputColor);
}
`}function nS(i){return`struct ${i}Uniforms {
  useByteColors: f32
};

@group(0) @binding(auto) var<uniform> ${i} : ${i}Uniforms;

fn ${i}_normalize(inputColor: vec3<f32>) -> vec3<f32> {
  return select(inputColor, inputColor / 255.0, ${i}.useByteColors > 0.5);
}

fn ${i}_normalize4(inputColor: vec4<f32>) -> vec4<f32> {
  return select(inputColor, inputColor / 255.0, ${i}.useByteColors > 0.5);
}

fn ${i}_premultiplyAlpha(inputColor: vec4<f32>) -> vec4<f32> {
  return vec4<f32>(inputColor.rgb * inputColor.a, inputColor.a);
}

fn ${i}_unpremultiplyAlpha(inputColor: vec4<f32>) -> vec4<f32> {
  return select(
    vec4<f32>(0.0),
    vec4<f32>(inputColor.rgb / inputColor.a, inputColor.a),
    inputColor.a > 0.0
  );
}

fn ${i}_premultiply_alpha(inputColor: vec4<f32>) -> vec4<f32> {
  return ${i}_premultiplyAlpha(inputColor);
}

fn ${i}_unpremultiply_alpha(inputColor: vec4<f32>) -> vec4<f32> {
  return ${i}_unpremultiplyAlpha(inputColor);
}
`}const sS={name:"floatColors",props:{},uniforms:{},vs:Ef,fs:Ef,source:tS,uniformTypes:J2,defaultUniforms:eS},rS=[0,1,1,1],oS=`layout(std140) uniform pickingUniforms {
  float isActive;
  float isAttribute;
  float isHighlightActive;
  float useByteColors;
  vec3 highlightedObjectColor;
  vec4 highlightColor;
} picking;

out vec4 picking_vRGBcolor_Avalid;

// Normalize unsigned byte color to 0-1 range
vec3 picking_normalizeColor(vec3 color) {
  return picking.useByteColors > 0.5 ? color / 255.0 : color;
}

// Normalize unsigned byte color to 0-1 range
vec4 picking_normalizeColor(vec4 color) {
  return picking.useByteColors > 0.5 ? color / 255.0 : color;
}

bool picking_isColorZero(vec3 color) {
  return dot(color, vec3(1.0)) < 0.00001;
}

bool picking_isColorValid(vec3 color) {
  return dot(color, vec3(1.0)) > 0.00001;
}

// Check if this vertex is highlighted 
bool isVertexHighlighted(vec3 vertexColor) {
  vec3 highlightedObjectColor = picking_normalizeColor(picking.highlightedObjectColor);
  return
    bool(picking.isHighlightActive) && picking_isColorZero(abs(vertexColor - highlightedObjectColor));
}

// Set the current picking color
void picking_setPickingColor(vec3 pickingColor) {
  pickingColor = picking_normalizeColor(pickingColor);

  if (bool(picking.isActive)) {
    // Use alpha as the validity flag. If pickingColor is [0, 0, 0] fragment is non-pickable
    picking_vRGBcolor_Avalid.a = float(picking_isColorValid(pickingColor));

    if (!bool(picking.isAttribute)) {
      // Stores the picking color so that the fragment shader can render it during picking
      picking_vRGBcolor_Avalid.rgb = pickingColor;
    }
  } else {
    // Do the comparison with selected item color in vertex shader as it should mean fewer compares
    picking_vRGBcolor_Avalid.a = float(isVertexHighlighted(pickingColor));
  }
}

void picking_setPickingAttribute(float value) {
  if (bool(picking.isAttribute)) {
    picking_vRGBcolor_Avalid.r = value;
  }
}

void picking_setPickingAttribute(vec2 value) {
  if (bool(picking.isAttribute)) {
    picking_vRGBcolor_Avalid.rg = value;
  }
}

void picking_setPickingAttribute(vec3 value) {
  if (bool(picking.isAttribute)) {
    picking_vRGBcolor_Avalid.rgb = value;
  }
}
`,aS=`layout(std140) uniform pickingUniforms {
  float isActive;
  float isAttribute;
  float isHighlightActive;
  float useByteColors;
  vec3 highlightedObjectColor;
  vec4 highlightColor;
} picking;

in vec4 picking_vRGBcolor_Avalid;

/*
 * Returns highlight color if this item is selected.
 */
vec4 picking_filterHighlightColor(vec4 color) {
  // If we are still picking, we don't highlight
  if (picking.isActive > 0.5) {
    return color;
  }

  bool selected = bool(picking_vRGBcolor_Avalid.a);

  if (selected) {
    // Blend in highlight color based on its alpha value
    float highLightAlpha = picking.highlightColor.a;
    float blendedAlpha = highLightAlpha + color.a * (1.0 - highLightAlpha);
    float highLightRatio = highLightAlpha / blendedAlpha;

    vec3 blendedRGB = mix(color.rgb, picking.highlightColor.rgb, highLightRatio);
    return vec4(blendedRGB, blendedAlpha);
  } else {
    return color;
  }
}

/*
 * Returns picking color if picking enabled else unmodified argument.
 */
vec4 picking_filterPickingColor(vec4 color) {
  if (bool(picking.isActive)) {
    if (picking_vRGBcolor_Avalid.a == 0.0) {
      discard;
    }
    return picking_vRGBcolor_Avalid;
  }
  return color;
}

/*
 * Returns picking color if picking is enabled if not
 * highlight color if this item is selected, otherwise unmodified argument.
 */
vec4 picking_filterColor(vec4 color) {
  vec4 highlightColor = picking_filterHighlightColor(color);
  return picking_filterPickingColor(highlightColor);
}
`,Si={props:{},uniforms:{},name:"picking",uniformTypes:{isActive:"f32",isAttribute:"f32",isHighlightActive:"f32",useByteColors:"f32",highlightedObjectColor:"vec3<f32>",highlightColor:"vec4<f32>"},defaultUniforms:{isActive:!1,isAttribute:!1,isHighlightActive:!1,useByteColors:!0,highlightedObjectColor:[0,0,0],highlightColor:rS},vs:oS,fs:aS,getUniforms:cS};function cS(i={},e){const t={},n=Lp(i.useByteColors,!0);if(i.highlightedObjectColor!==void 0)if(i.highlightedObjectColor===null)t.isHighlightActive=!1;else{t.isHighlightActive=!0;const s=i.highlightedObjectColor.slice(0,3);t.highlightedObjectColor=s}return i.highlightColor&&(t.highlightColor=W2(i.highlightColor,n)),i.isActive!==void 0&&(t.isActive=!!i.isActive,t.isAttribute=!!i.isAttribute),i.useByteColors!==void 0&&(t.useByteColors=!!i.useByteColors),t}const Cf=`precision highp int;

// #if (defined(SHADER_TYPE_FRAGMENT) && defined(LIGHTING_FRAGMENT)) || (defined(SHADER_TYPE_VERTEX) && defined(LIGHTING_VERTEX))
struct AmbientLight {
  vec3 color;
};

struct PointLight {
  vec3 color;
  vec3 position;
  vec3 attenuation; // 2nd order x:Constant-y:Linear-z:Exponential
};

struct SpotLight {
  vec3 color;
  vec3 position;
  vec3 direction;
  vec3 attenuation;
  vec2 coneCos;
};

struct DirectionalLight {
  vec3 color;
  vec3 direction;
};

struct UniformLight {
  vec3 color;
  vec3 position;
  vec3 direction;
  vec3 attenuation;
  vec2 coneCos;
};

layout(std140) uniform lightingUniforms {
  int enabled;
  int directionalLightCount;
  int pointLightCount;
  int spotLightCount;
  vec3 ambientColor;
  UniformLight lights[5];
} lighting;

PointLight lighting_getPointLight(int index) {
  UniformLight light = lighting.lights[index];
  return PointLight(light.color, light.position, light.attenuation);
}

SpotLight lighting_getSpotLight(int index) {
  UniformLight light = lighting.lights[lighting.pointLightCount + index];
  return SpotLight(light.color, light.position, light.direction, light.attenuation, light.coneCos);
}

DirectionalLight lighting_getDirectionalLight(int index) {
  UniformLight light =
    lighting.lights[lighting.pointLightCount + lighting.spotLightCount + index];
  return DirectionalLight(light.color, light.direction);
}

float getPointLightAttenuation(PointLight pointLight, float distance) {
  return pointLight.attenuation.x
       + pointLight.attenuation.y * distance
       + pointLight.attenuation.z * distance * distance;
}

float getSpotLightAttenuation(SpotLight spotLight, vec3 positionWorldspace) {
  vec3 light_direction = normalize(positionWorldspace - spotLight.position);
  float coneFactor = smoothstep(
    spotLight.coneCos.y,
    spotLight.coneCos.x,
    dot(normalize(spotLight.direction), light_direction)
  );
  float distanceAttenuation = getPointLightAttenuation(
    PointLight(spotLight.color, spotLight.position, spotLight.attenuation),
    distance(spotLight.position, positionWorldspace)
  );
  return distanceAttenuation / max(coneFactor, 0.0001);
}

// #endif
`,lS=`// #if (defined(SHADER_TYPE_FRAGMENT) && defined(LIGHTING_FRAGMENT)) || (defined(SHADER_TYPE_VERTEX) && defined(LIGHTING_VERTEX))
const MAX_LIGHTS: i32 = 5;

struct AmbientLight {
  color: vec3<f32>,
};

struct PointLight {
  color: vec3<f32>,
  position: vec3<f32>,
  attenuation: vec3<f32>, // 2nd order x:Constant-y:Linear-z:Exponential
};

struct SpotLight {
  color: vec3<f32>,
  position: vec3<f32>,
  direction: vec3<f32>,
  attenuation: vec3<f32>,
  coneCos: vec2<f32>,
};

struct DirectionalLight {
  color: vec3<f32>,
  direction: vec3<f32>,
};

struct UniformLight {
  color: vec3<f32>,
  position: vec3<f32>,
  direction: vec3<f32>,
  attenuation: vec3<f32>,
  coneCos: vec2<f32>,
};

struct lightingUniforms {
  enabled: i32,
  directionalLightCount: i32,
  pointLightCount: i32,
  spotLightCount: i32,
  ambientColor: vec3<f32>,
  lights: array<UniformLight, 5>,
};

@group(2) @binding(auto) var<uniform> lighting : lightingUniforms;

fn lighting_getPointLight(index: i32) -> PointLight {
  let light = lighting.lights[index];
  return PointLight(light.color, light.position, light.attenuation);
}

fn lighting_getSpotLight(index: i32) -> SpotLight {
  let light = lighting.lights[lighting.pointLightCount + index];
  return SpotLight(light.color, light.position, light.direction, light.attenuation, light.coneCos);
}

fn lighting_getDirectionalLight(index: i32) -> DirectionalLight {
  let light = lighting.lights[lighting.pointLightCount + lighting.spotLightCount + index];
  return DirectionalLight(light.color, light.direction);
}

fn getPointLightAttenuation(pointLight: PointLight, distance: f32) -> f32 {
  return pointLight.attenuation.x
       + pointLight.attenuation.y * distance
       + pointLight.attenuation.z * distance * distance;
}

fn getSpotLightAttenuation(spotLight: SpotLight, positionWorldspace: vec3<f32>) -> f32 {
  let lightDirection = normalize(positionWorldspace - spotLight.position);
  let coneFactor = smoothstep(
    spotLight.coneCos.y,
    spotLight.coneCos.x,
    dot(normalize(spotLight.direction), lightDirection)
  );
  let distanceAttenuation = getPointLightAttenuation(
    PointLight(spotLight.color, spotLight.position, spotLight.attenuation),
    distance(spotLight.position, positionWorldspace)
  );
  return distanceAttenuation / max(coneFactor, 0.0001);
}
`,Jt=5,uS={color:"vec3<f32>",position:"vec3<f32>",direction:"vec3<f32>",attenuation:"vec3<f32>",coneCos:"vec2<f32>"},fS={props:{},uniforms:{},name:"lighting",defines:{},uniformTypes:{enabled:"i32",directionalLightCount:"i32",pointLightCount:"i32",spotLightCount:"i32",ambientColor:"vec3<f32>",lights:[uS,Jt]},defaultUniforms:Vs(),bindingLayout:[{name:"lighting",group:2}],firstBindingSlot:0,source:lS,vs:Cf,fs:Cf,getUniforms:dS};function dS(i,e={}){if(i=i&&{...i},!i)return Vs();i.lights&&(i={...i,...gS(i.lights),lights:void 0});const{useByteColors:t,ambientLight:n,pointLights:s,spotLights:r,directionalLights:o}=i||{};if(!(n||s&&s.length>0||r&&r.length>0||o&&o.length>0))return{...Vs(),enabled:0};const c={...Vs(),...hS({useByteColors:t,ambientLight:n,pointLights:s,spotLights:r,directionalLights:o})};return i.enabled!==void 0&&(c.enabled=i.enabled?1:0),c}function hS({useByteColors:i,ambientLight:e,pointLights:t=[],spotLights:n=[],directionalLights:s=[]}){const r=Ap();let o=0,a=0,c=0,l=0;for(const u of t){if(o>=Jt)break;r[o]={...r[o],color:Cs(u,i),position:u.position,attenuation:u.attenuation||[1,0,0]},o++,a++}for(const u of n){if(o>=Jt)break;r[o]={...r[o],color:Cs(u,i),position:u.position,direction:u.direction,attenuation:u.attenuation||[1,0,0],coneCos:mS(u)},o++,c++}for(const u of s){if(o>=Jt)break;r[o]={...r[o],color:Cs(u,i),direction:u.direction},o++,l++}return t.length+n.length+s.length>Jt&&A.warn(`MAX_LIGHTS exceeded, truncating to ${Jt}`)(),{ambientColor:Cs(e,i),directionalLightCount:l,pointLightCount:a,spotLightCount:c,lights:r}}function gS(i){const e={pointLights:[],spotLights:[],directionalLights:[]};for(const t of i||[])switch(t.type){case"ambient":e.ambientLight=t;break;case"directional":e.directionalLights?.push(t);break;case"point":e.pointLights?.push(t);break;case"spot":e.spotLights?.push(t);break}return e}function Cs(i={},e){const{color:t=[0,0,0],intensity:n=1}=i;return Tp(t,Lp(e,!0)).map(r=>r*n)}function Vs(){return{enabled:1,directionalLightCount:0,pointLightCount:0,spotLightCount:0,ambientColor:[.1,.1,.1],lights:Ap()}}function Ap(){return Array.from({length:Jt},()=>pS())}function pS(){return{color:[1,1,1],position:[1,1,2],direction:[1,1,1],attenuation:[1,0,0],coneCos:[1,0]}}function mS(i){const e=i.innerConeAngle??0,t=i.outerConeAngle??Math.PI/4;return[Math.cos(e),Math.cos(t)]}const yS=`layout(std140) uniform phongMaterialUniforms {
  uniform bool unlit;
  uniform float ambient;
  uniform float diffuse;
  uniform float shininess;
  uniform vec3  specularColor;
} material;
`,_S=`layout(std140) uniform phongMaterialUniforms {
  uniform bool unlit;
  uniform float ambient;
  uniform float diffuse;
  uniform float shininess;
  uniform vec3  specularColor;
} material;

vec3 lighting_getLightColor(vec3 surfaceColor, vec3 light_direction, vec3 view_direction, vec3 normal_worldspace, vec3 color) {
  vec3 halfway_direction = normalize(light_direction + view_direction);
  float lambertian = dot(light_direction, normal_worldspace);
  float specular = 0.0;
  if (lambertian > 0.0) {
    float specular_angle = max(dot(normal_worldspace, halfway_direction), 0.0);
    specular = pow(specular_angle, material.shininess);
  }
  lambertian = max(lambertian, 0.0);
  return (lambertian * material.diffuse * surfaceColor + specular * floatColors_normalize(material.specularColor)) * color;
}

vec3 lighting_getLightColor(vec3 surfaceColor, vec3 cameraPosition, vec3 position_worldspace, vec3 normal_worldspace) {
  vec3 lightColor = surfaceColor;

  if (material.unlit) {
    return surfaceColor;
  }

  if (lighting.enabled == 0) {
    return lightColor;
  }

  vec3 view_direction = normalize(cameraPosition - position_worldspace);
  lightColor = material.ambient * surfaceColor * lighting.ambientColor;

  for (int i = 0; i < lighting.pointLightCount; i++) {
    PointLight pointLight = lighting_getPointLight(i);
    vec3 light_position_worldspace = pointLight.position;
    vec3 light_direction = normalize(light_position_worldspace - position_worldspace);
    float light_attenuation = getPointLightAttenuation(pointLight, distance(light_position_worldspace, position_worldspace));
    lightColor += lighting_getLightColor(surfaceColor, light_direction, view_direction, normal_worldspace, pointLight.color / light_attenuation);
  }

  for (int i = 0; i < lighting.spotLightCount; i++) {
    SpotLight spotLight = lighting_getSpotLight(i);
    vec3 light_position_worldspace = spotLight.position;
    vec3 light_direction = normalize(light_position_worldspace - position_worldspace);
    float light_attenuation = getSpotLightAttenuation(spotLight, position_worldspace);
    lightColor += lighting_getLightColor(surfaceColor, light_direction, view_direction, normal_worldspace, spotLight.color / light_attenuation);
  }

  for (int i = 0; i < lighting.directionalLightCount; i++) {
    DirectionalLight directionalLight = lighting_getDirectionalLight(i);
    lightColor += lighting_getLightColor(surfaceColor, -directionalLight.direction, view_direction, normal_worldspace, directionalLight.color);
  }
  
  return lightColor;
}
`,bS=`struct phongMaterialUniforms {
  unlit: u32,
  ambient: f32,
  diffuse: f32,
  shininess: f32,
  specularColor: vec3<f32>,
};

@group(3) @binding(auto) var<uniform> phongMaterial : phongMaterialUniforms;

fn lighting_getLightColor(surfaceColor: vec3<f32>, light_direction: vec3<f32>, view_direction: vec3<f32>, normal_worldspace: vec3<f32>, color: vec3<f32>) -> vec3<f32> {
  let halfway_direction: vec3<f32> = normalize(light_direction + view_direction);
  var lambertian: f32 = dot(light_direction, normal_worldspace);
  var specular: f32 = 0.0;
  if (lambertian > 0.0) {
    let specular_angle = max(dot(normal_worldspace, halfway_direction), 0.0);
    specular = pow(specular_angle, phongMaterial.shininess);
  }
  lambertian = max(lambertian, 0.0);
  return (
    lambertian * phongMaterial.diffuse * surfaceColor +
    specular * floatColors_normalize(phongMaterial.specularColor)
  ) * color;
}

fn lighting_getLightColor2(surfaceColor: vec3<f32>, cameraPosition: vec3<f32>, position_worldspace: vec3<f32>, normal_worldspace: vec3<f32>) -> vec3<f32> {
  var lightColor: vec3<f32> = surfaceColor;

  if (phongMaterial.unlit != 0u) {
    return surfaceColor;
  }

  if (lighting.enabled == 0) {
    return lightColor;
  }

  let view_direction: vec3<f32> = normalize(cameraPosition - position_worldspace);
  lightColor = phongMaterial.ambient * surfaceColor * lighting.ambientColor;

  for (var i: i32 = 0; i < lighting.pointLightCount; i++) {
    let pointLight: PointLight = lighting_getPointLight(i);
    let light_position_worldspace: vec3<f32> = pointLight.position;
    let light_direction: vec3<f32> = normalize(light_position_worldspace - position_worldspace);
    let light_attenuation = getPointLightAttenuation(
      pointLight,
      distance(light_position_worldspace, position_worldspace)
    );
    lightColor += lighting_getLightColor(
      surfaceColor,
      light_direction,
      view_direction,
      normal_worldspace,
      pointLight.color / light_attenuation
    );
  }

  for (var i: i32 = 0; i < lighting.spotLightCount; i++) {
    let spotLight: SpotLight = lighting_getSpotLight(i);
    let light_position_worldspace: vec3<f32> = spotLight.position;
    let light_direction: vec3<f32> = normalize(light_position_worldspace - position_worldspace);
    let light_attenuation = getSpotLightAttenuation(spotLight, position_worldspace);
    lightColor += lighting_getLightColor(
      surfaceColor,
      light_direction,
      view_direction,
      normal_worldspace,
      spotLight.color / light_attenuation
    );
  }

  for (var i: i32 = 0; i < lighting.directionalLightCount; i++) {
    let directionalLight: DirectionalLight = lighting_getDirectionalLight(i);
    lightColor += lighting_getLightColor(surfaceColor, -directionalLight.direction, view_direction, normal_worldspace, directionalLight.color);
  }  
  
  return lightColor;
}

fn lighting_getSpecularLightColor(cameraPosition: vec3<f32>, position_worldspace: vec3<f32>, normal_worldspace: vec3<f32>) -> vec3<f32>{
  var lightColor = vec3<f32>(0, 0, 0);
  let surfaceColor = vec3<f32>(0, 0, 0);

  if (lighting.enabled != 0) {
    let view_direction = normalize(cameraPosition - position_worldspace);

    for (var i: i32 = 0; i < lighting.pointLightCount; i++) {
      let pointLight: PointLight = lighting_getPointLight(i);
      let light_position_worldspace: vec3<f32> = pointLight.position;
      let light_direction: vec3<f32> = normalize(light_position_worldspace - position_worldspace);
      let light_attenuation = getPointLightAttenuation(
        pointLight,
        distance(light_position_worldspace, position_worldspace)
      );
      lightColor += lighting_getLightColor(
        surfaceColor,
        light_direction,
        view_direction,
        normal_worldspace,
        pointLight.color / light_attenuation
      );
    }

    for (var i: i32 = 0; i < lighting.spotLightCount; i++) {
      let spotLight: SpotLight = lighting_getSpotLight(i);
      let light_position_worldspace: vec3<f32> = spotLight.position;
      let light_direction: vec3<f32> = normalize(light_position_worldspace - position_worldspace);
      let light_attenuation = getSpotLightAttenuation(spotLight, position_worldspace);
      lightColor += lighting_getLightColor(
        surfaceColor,
        light_direction,
        view_direction,
        normal_worldspace,
        spotLight.color / light_attenuation
      );
    }

    for (var i: i32 = 0; i < lighting.directionalLightCount; i++) {
        let directionalLight: DirectionalLight = lighting_getDirectionalLight(i);
        lightColor += lighting_getLightColor(surfaceColor, -directionalLight.direction, view_direction, normal_worldspace, directionalLight.color);
    }
  }
  return lightColor;
}
`,vS=[38.25,38.25,38.25],Mp={props:{},name:"gouraudMaterial",bindingLayout:[{name:"gouraudMaterial",group:3}],vs:_S.replace("phongMaterial","gouraudMaterial"),fs:yS.replace("phongMaterial","gouraudMaterial"),source:bS.replaceAll("phongMaterial","gouraudMaterial"),defines:{LIGHTING_VERTEX:!0},dependencies:[fS,sS],uniformTypes:{unlit:"i32",ambient:"f32",diffuse:"f32",shininess:"f32",specularColor:"vec3<f32>"},defaultUniforms:{unlit:!1,ambient:.35,diffuse:.6,shininess:32,specularColor:vS},getUniforms(i){return{...Mp.defaultUniforms,...i}}},xS=`struct LayerUniforms {
  opacity: f32,
};

@group(0) @binding(auto)
var<uniform> layer: LayerUniforms;
`,Lf=`layout(std140) uniform layerUniforms {
  uniform float opacity;
} layer;
`,wS={name:"layer",source:xS,vs:Lf,fs:Lf,getUniforms:i=>({opacity:Math.pow(i.opacity,1/2.2)}),uniformTypes:{opacity:"f32"}},PS=`

@must_use
fn deckgl_premultiplied_alpha(fragColor: vec4<f32>) -> vec4<f32> {
    return vec4(fragColor.rgb * fragColor.a, fragColor.a); 
};
`,_i={name:"color",dependencies:[],source:PS,getUniforms:i=>({})},SS=`const SMOOTH_EDGE_RADIUS: f32 = 0.5;

struct VertexGeometry {
  position: vec4<f32>,
  worldPosition: vec3<f32>,
  worldPositionAlt: vec3<f32>,
  normal: vec3<f32>,
  uv: vec2<f32>,
  pickingColor: vec3<f32>,
};

var<private> geometry_: VertexGeometry = VertexGeometry(
  vec4<f32>(0.0, 0.0, 1.0, 0.0),
  vec3<f32>(0.0, 0.0, 0.0),
  vec3<f32>(0.0, 0.0, 0.0),
  vec3<f32>(0.0, 0.0, 0.0),
  vec2<f32>(0.0, 0.0),
  vec3<f32>(0.0, 0.0, 0.0)
);

struct FragmentGeometry {
  uv: vec2<f32>,
};

var<private> fragmentGeometry: FragmentGeometry;

fn smoothedge(edge: f32, x: f32) -> f32 {
  return smoothstep(edge - SMOOTH_EDGE_RADIUS, edge + SMOOTH_EDGE_RADIUS, x);
}
`,Ip="#define SMOOTH_EDGE_RADIUS 0.5",ES=`${Ip}

struct VertexGeometry {
  vec4 position;
  vec3 worldPosition;
  vec3 worldPositionAlt;
  vec3 normal;
  vec2 uv;
  vec3 pickingColor;
} geometry = VertexGeometry(
  vec4(0.0, 0.0, 1.0, 0.0),
  vec3(0.0),
  vec3(0.0),
  vec3(0.0),
  vec2(0.0),
  vec3(0.0)
);
`,CS=`${Ip}

struct FragmentGeometry {
  vec2 uv;
};
FragmentGeometry geometry;

float smoothedge(float edge, float x) {
  return smoothstep(edge - SMOOTH_EDGE_RADIUS, edge + SMOOTH_EDGE_RADIUS, x);
}
`,Rp={name:"geometry",source:SS,vs:ES,fs:CS},LS=25;var Z;(function(i){i[i.Start=1]="Start",i[i.Move=2]="Move",i[i.End=4]="End",i[i.Cancel=8]="Cancel"})(Z||(Z={}));var xe;(function(i){i[i.None=0]="None",i[i.Left=1]="Left",i[i.Right=2]="Right",i[i.Up=4]="Up",i[i.Down=8]="Down",i[i.Horizontal=3]="Horizontal",i[i.Vertical=12]="Vertical",i[i.All=15]="All"})(xe||(xe={}));var $;(function(i){i[i.Possible=1]="Possible",i[i.Began=2]="Began",i[i.Changed=4]="Changed",i[i.Ended=8]="Ended",i[i.Recognized=8]="Recognized",i[i.Cancelled=16]="Cancelled",i[i.Failed=32]="Failed"})($||($={}));const TS="compute",AS="auto",Er="manipulation",js="none",uc="pan-x",fc="pan-y";function MS(i){if(i.includes(js))return js;const e=i.includes(uc),t=i.includes(fc);return e&&t?js:e||t?e?uc:fc:i.includes(Er)?Er:AS}class IS{constructor(e,t){this.actions="",this.manager=e,this.set(t)}set(e){e===TS&&(e=this.compute()),this.manager.element&&(this.manager.element.style.touchAction=e,this.actions=e)}update(){this.set(this.manager.options.touchAction)}compute(){let e=[];for(const t of this.manager.recognizers)t.options.enable&&(e=e.concat(t.getTouchAction()));return MS(e.join(" "))}}function Cr(i){return i.trim().split(/\s+/g)}function Yo(i,e,t){if(i)for(const n of Cr(e))i.addEventListener(n,t,!1)}function qo(i,e,t){if(i)for(const n of Cr(e))i.removeEventListener(n,t,!1)}function Tf(i){return(i.ownerDocument||i).defaultView}function RS(i,e){let t=i;for(;t;){if(t===e)return!0;t=t.parentNode}return!1}function Op(i){const e=i.length;if(e===1)return{x:Math.round(i[0].clientX),y:Math.round(i[0].clientY)};let t=0,n=0,s=0;for(;s<e;)t+=i[s].clientX,n+=i[s].clientY,s++;return{x:Math.round(t/e),y:Math.round(n/e)}}function Af(i){const e=[];let t=0;for(;t<i.pointers.length;)e[t]={clientX:Math.round(i.pointers[t].clientX),clientY:Math.round(i.pointers[t].clientY)},t++;return{timeStamp:Date.now(),pointers:e,center:Op(e),deltaX:i.deltaX,deltaY:i.deltaY}}function Al(i,e){const t=e.x-i.x,n=e.y-i.y;return Math.sqrt(t*t+n*n)}function dc(i,e){const t=e.clientX-i.clientX,n=e.clientY-i.clientY;return Math.sqrt(t*t+n*n)}function OS(i,e){const t=e.x-i.x,n=e.y-i.y;return Math.atan2(n,t)*180/Math.PI}function Mf(i,e){const t=e.clientX-i.clientX,n=e.clientY-i.clientY;return Math.atan2(n,t)*180/Math.PI}function Ml(i,e){return i===e?xe.None:Math.abs(i)>=Math.abs(e)?i<0?xe.Left:xe.Right:e<0?xe.Up:xe.Down}function kS(i,e){const t=e.center;let n=i.offsetDelta,s=i.prevDelta;const r=i.prevInput;return(e.eventType===Z.Start||r?.eventType===Z.End)&&(s=i.prevDelta={x:r?.deltaX||0,y:r?.deltaY||0},n=i.offsetDelta={x:t.x,y:t.y}),{deltaX:s.x+(t.x-n.x),deltaY:s.y+(t.y-n.y)}}function kp(i,e,t){return{x:e/i||0,y:t/i||0}}function BS(i,e){return dc(e[0],e[1])/dc(i[0],i[1])}function DS(i,e){return Mf(e[1],e[0])-Mf(i[1],i[0])}function FS(i,e){const t=i.lastInterval||e,n=e.timeStamp-t.timeStamp;let s,r,o,a;if(e.eventType!==Z.Cancel&&(n>LS||t.velocity===void 0)){const c=e.deltaX-t.deltaX,l=e.deltaY-t.deltaY,u=kp(n,c,l);r=u.x,o=u.y,s=Math.abs(u.x)>Math.abs(u.y)?u.x:u.y,a=Ml(c,l),i.lastInterval=e}else s=t.velocity,r=t.velocityX,o=t.velocityY,a=t.direction;e.velocity=s,e.velocityX=r,e.velocityY=o,e.direction=a}function hc(i,e){return"pointerId"in i?i.pointerId:e}function If(i,e){i.movementOrigin=new Map(e.map((t,n)=>[hc(t,n),{clientX:t.clientX,clientY:t.clientY}])),i.firstMovementTime=void 0}function zS(i,e){const t=e.pointers.map(hc);if(i.movementOrigin?.size===t.length&&t.every(s=>i.movementOrigin.has(s))||If(i,e.pointers),e.distancePerPointer=e.pointers.map((s,r)=>dc(i.movementOrigin.get(t[r]),s)),e.eventType&Z.Move&&e.distancePerPointer.some(s=>s>0)&&(i.firstMovementTime??(i.firstMovementTime=e.timeStamp)),e.movementDeltaTime=i.firstMovementTime===void 0?0:e.timeStamp-i.firstMovementTime,e.eventType&(Z.End|Z.Cancel)){const s=e.changedPointers.map(r=>hc(r,e.pointers.indexOf(r)));If(i,e.pointers.filter((r,o)=>!s.includes(t[o])))}}function NS(i,e){const{session:t}=i,{pointers:n}=e,{length:s}=n;t.firstInput||(t.firstInput=Af(e)),s>1&&!t.firstMultiple?t.firstMultiple=Af(e):s===1&&(t.firstMultiple=!1);const{firstInput:r,firstMultiple:o}=t,a=o?o.center:r.center,c=e.center=Op(n);e.timeStamp=Date.now(),e.deltaTime=e.timeStamp-r.timeStamp,zS(t,e),e.angle=OS(a,c),e.distance=Al(a,c);const{deltaX:l,deltaY:u}=kS(t,e);e.deltaX=l,e.deltaY=u,e.offsetDirection=Ml(e.deltaX,e.deltaY);const f=kp(e.deltaTime,e.deltaX,e.deltaY);e.overallVelocityX=f.x,e.overallVelocityY=f.y,e.overallVelocity=Math.abs(f.x)>Math.abs(f.y)?f.x:f.y,e.scale=o?BS(o.pointers,n):1,e.rotation=o?DS(o.pointers,n):0,e.maxPointers=t.prevInput?e.pointers.length>t.prevInput.maxPointers?e.pointers.length:t.prevInput.maxPointers:e.pointers.length;let d=i.element;return RS(e.srcEvent.target,d)&&(d=e.srcEvent.target),e.target=d,FS(t,e),e}function US(i,e,t){const n=t.pointers.length,s=t.changedPointers.length,r=e&Z.Start&&n-s===0,o=e&(Z.End|Z.Cancel)&&n-s===0;t.isFirst=!!r,t.isFinal=!!o,r&&(i.session={}),t.eventType=e;const a=NS(i,t);i.emit("hammer.input",a),i.recognize(a),i.session.prevInput=a}let $S=class{constructor(e){this.evEl="",this.evWin="",this.evTarget="",this.domHandler=t=>{this.manager.options.enable&&this.handler(t)},this.manager=e,this.element=e.element,this.target=e.options.inputTarget||e.element}callback(e,t){US(this.manager,e,t)}init(){Yo(this.element,this.evEl,this.domHandler),Yo(this.target,this.evTarget,this.domHandler),Yo(Tf(this.element),this.evWin,this.domHandler)}destroy(){qo(this.element,this.evEl,this.domHandler),qo(this.target,this.evTarget,this.domHandler),qo(Tf(this.element),this.evWin,this.domHandler)}};const GS={pointerdown:Z.Start,pointermove:Z.Move,pointerup:Z.End,pointercancel:Z.Cancel,pointerout:Z.Cancel},VS="pointerdown",jS="pointermove pointerup pointercancel";class WS extends $S{constructor(e){super(e),this.evEl=VS,this.evWin=jS,this.store=this.manager.session.pointerEvents=[],this.init()}handler(e){const{store:t}=this;let n=!1;const s=GS[e.type],r=e.pointerType,o=r==="touch";let a=t.findIndex(c=>c.pointerId===e.pointerId);s&Z.Start&&(e.buttons||o)?a<0&&(t.push(e),a=t.length-1):s&(Z.End|Z.Cancel)&&(n=!0),!(a<0)&&(t[a]=e,this.callback(s,{pointers:t,changedPointers:[e],eventType:s,pointerType:r,srcEvent:e}),n&&t.splice(a,1))}}const HS=["","webkit","Moz","MS","ms","o"];function YS(i,e){const t=e[0].toUpperCase()+e.slice(1);for(const n of HS){const s=n?n+t:e;if(s in i)return s}}const qS=1,Rf=2,Of={touchAction:"compute",enable:!0,inputTarget:null,cssProps:{userSelect:"none",userDrag:"none",touchCallout:"none",tapHighlightColor:"rgba(0,0,0,0)"}};class ZS{constructor(e,t){this.options={...Of,...t,cssProps:{...Of.cssProps,...t.cssProps},inputTarget:t.inputTarget||e},this.handlers={},this.session={},this.recognizers=[],this.oldCssProps={},this.element=e,this.input=new WS(this),this.touchAction=new IS(this,this.options.touchAction),this.toggleCssProps(!0)}set(e){return Object.assign(this.options,e),e.touchAction&&this.touchAction.update(),e.inputTarget&&(this.input.destroy(),this.input.target=e.inputTarget,this.input.init()),this}stop(e){this.session.stopped=e?Rf:qS}recognize(e){const{session:t}=this;if(t.stopped)return;this.session.prevented&&e.srcEvent.preventDefault();let n;const{recognizers:s}=this;let{curRecognizer:r}=t;(!r||r&&r.state&$.Recognized)&&(r=t.curRecognizer=null);let o=0;for(;o<s.length;)n=s[o],t.stopped!==Rf&&(!r||n===r||n.canRecognizeWith(r))?n.recognize(e):n.reset(),!r&&n.state&($.Began|$.Changed|$.Ended)&&(r=t.curRecognizer=n),o++}get(e){const{recognizers:t}=this;for(let n=0;n<t.length;n++)if(t[n].options.event===e)return t[n];return null}add(e){if(Array.isArray(e)){for(const n of e)this.add(n);return this}const t=this.get(e.options.event);return t&&this.remove(t),this.recognizers.push(e),e.manager=this,this.touchAction.update(),e}remove(e){if(Array.isArray(e)){for(const n of e)this.remove(n);return this}const t=typeof e=="string"?this.get(e):e;if(t){const{recognizers:n}=this,s=n.indexOf(t);s!==-1&&(n.splice(s,1),this.touchAction.update())}return this}on(e,t){if(!e||!t)return;const{handlers:n}=this;for(const s of Cr(e))n[s]=n[s]||[],n[s].push(t)}off(e,t){if(!e)return;const{handlers:n}=this;for(const s of Cr(e))t?n[s]&&n[s].splice(n[s].indexOf(t),1):delete n[s]}emit(e,t){const n=this.handlers[e]&&this.handlers[e].slice();if(!n||!n.length)return;const s=t;s.type=e,s.preventDefault=function(){t.srcEvent.preventDefault()};let r=0;for(;r<n.length;)n[r](s),r++}destroy(){this.toggleCssProps(!1),this.handlers={},this.session={},this.input.destroy(),this.element=null}toggleCssProps(e){const{element:t}=this;if(t){for(const[n,s]of Object.entries(this.options.cssProps)){const r=YS(t.style,n);e?(this.oldCssProps[r]=t.style[r],t.style[r]=s):t.style[r]=this.oldCssProps[r]||""}e||(this.oldCssProps={})}}}let XS=1;function KS(){return XS++}function kf(i){return i&$.Cancelled?"cancel":i&$.Ended?"end":i&$.Changed?"move":i&$.Began?"start":""}class Il{constructor(e){this.options=e,this.id=KS(),this.state=$.Possible,this.simultaneous={},this.requireFail=[]}set(e){return Object.assign(this.options,e),this.manager.touchAction.update(),this}recognizeWith(e){if(Array.isArray(e)){for(const s of e)this.recognizeWith(s);return this}let t;if(typeof e=="string"){if(t=this.manager.get(e),!t)throw new Error(`Cannot find recognizer ${e}`)}else t=e;const{simultaneous:n}=this;return n[t.id]||(n[t.id]=t,t.recognizeWith(this)),this}dropRecognizeWith(e){if(Array.isArray(e)){for(const n of e)this.dropRecognizeWith(n);return this}let t;return typeof e=="string"?t=this.manager.get(e):t=e,t&&delete this.simultaneous[t.id],this}requireFailure(e){if(Array.isArray(e)){for(const s of e)this.requireFailure(s);return this}let t;if(typeof e=="string"){if(t=this.manager.get(e),!t)throw new Error(`Cannot find recognizer ${e}`)}else t=e;const{requireFail:n}=this;return n.indexOf(t)===-1&&(n.push(t),t.requireFailure(this)),this}dropRequireFailure(e){if(Array.isArray(e)){for(const n of e)this.dropRequireFailure(n);return this}let t;if(typeof e=="string"?t=this.manager.get(e):t=e,t){const n=this.requireFail.indexOf(t);n>-1&&this.requireFail.splice(n,1)}return this}hasRequireFailures(){return!!this.requireFail.find(e=>e.options.enable)}canRecognizeWith(e){return!!this.simultaneous[e.id]}emit(e){if(!e)return;const{state:t}=this;t<$.Ended&&this.manager.emit(this.options.event+kf(t),e),this.manager.emit(this.options.event,e),e.additionalEvent&&this.manager.emit(e.additionalEvent,e),t>=$.Ended&&this.manager.emit(this.options.event+kf(t),e)}tryEmit(e){this.canEmit()?this.emit(e):this.state=$.Failed}canEmit(){let e=0;for(;e<this.requireFail.length;){if(!(this.requireFail[e].state&($.Failed|$.Possible)))return!1;e++}return!0}recognize(e){const t={...e};if(!this.options.enable){this.reset(),this.state=$.Failed;return}this.state&($.Recognized|$.Cancelled|$.Failed)&&(this.state=$.Possible),this.state=this.process(t),this.state&($.Began|$.Changed|$.Ended|$.Cancelled)&&this.tryEmit(t)}getEventNames(){return[this.options.event]}reset(){}}function QS(i){return Math.abs(((i+180)%360+360)%360-180)}function JS(i,e){return(e.distance===void 0||i.distance>=e.distance)&&(e.distancePerPointer===void 0||i.distancePerPointer.length>0&&i.distancePerPointer.every(t=>t>=e.distancePerPointer))&&(e.movementDeltaTime===void 0||i.movementDeltaTime>=e.movementDeltaTime)&&(e.rotation===void 0||QS(i.rotation)>=e.rotation)&&(e.scale===void 0||Math.abs(i.scale-1)>=e.scale)}class e3 extends Il{attrTest(e){const t=this.options.pointers;return t===0||e.pointers.length===t}coherentTest(e){const t=this.options.coherent;return!t?.length||t.some(n=>JS(e,n))}process(e){const{state:t}=this,{eventType:n}=e,s=t&($.Began|$.Changed),r=this.attrTest(e);return s&&(n&Z.Cancel||!r)?t|$.Cancelled:s||r?n&Z.End?t|$.Ended:t&$.Began?t|$.Changed:$.Began:$.Failed}}const t3=["","start","move","end","cancel"];class i3 extends Il{constructor(e={}){super({enable:!0,event:"doubleclickdrag",pointers:1,interval:500,time:350,threshold:28,dragThreshold:1,pixelsPerScale:120,...e}),this._tapStart=null,this._lastTap=null,this._drag=null,this._emittedStart=!1}getTouchAction(){return[Er]}getEventNames(){return t3.map(e=>this.options.event+e)}process(e){const{options:t}=this;return e.pointers.length===t.pointers?e.eventType&Z.Start?this._handleStart(e):e.eventType&Z.Move?this._handleMove(e):e.eventType&Z.Cancel?this._handleEnd(e,!0):e.eventType&Z.End?this._handleEnd(e,!1):$.Failed:(this.reset(),$.Failed)}reset(){this._tapStart=null,this._lastTap=null,this._drag=null,this._emittedStart=!1}emit(e){if(e){if(this.state===$.Began){if(!this._drag?.active||this._emittedStart)return;this._emittedStart=!0,this.manager.emit(`${this.options.event}start`,e),this.manager.emit(this.options.event,e);return}if(this.state===$.Changed){if(!this._emittedStart)return;this.manager.emit(`${this.options.event}move`,e),this.manager.emit(this.options.event,e);return}if(this.state===$.Ended){if(!this._emittedStart)return;this.manager.emit(this.options.event,e),this.manager.emit(`${this.options.event}end`,e),this._emittedStart=!1;return}if(this.state===$.Cancelled){if(!this._emittedStart)return;this.manager.emit(this.options.event,e),this.manager.emit(`${this.options.event}cancel`,e),this._emittedStart=!1}}}_handleStart(e){const t=this._getPointerId(e);return this._lastTap&&this._isTapMatch(e,this._lastTap)?(this._tapStart=null,this._lastTap=null,this._drag={startCenter:e.center,pointerId:t,active:!1},this._emittedStart=!1,$.Began):(this._tapStart={center:e.center,timeStamp:e.timeStamp,pointerId:t},this._lastTap=null,this._drag=null,this._emittedStart=!1,$.Failed)}_handleMove(e){if(!this._drag||!this._isSamePointer(e,this._drag.pointerId))return $.Failed;const t=this._drag.startCenter.y-e.center.y;return!this._drag.active&&Math.abs(t)<this.options.dragThreshold?$.Began:(this._drag.active=!0,e.scale=Math.pow(2,t/this.options.pixelsPerScale),this._emittedStart?$.Changed:$.Began)}_handleEnd(e,t){if(this._drag&&this._isSamePointer(e,this._drag.pointerId)){const{active:n,startCenter:s}=this._drag;if(this._drag=null,this._tapStart=null,this._lastTap=null,!n)return this._emittedStart=!1,$.Failed;const r=s.y-e.center.y;return e.scale=Math.pow(2,r/this.options.pixelsPerScale),t?$.Cancelled:$.Ended}return!this._tapStart||!this._isSamePointer(e,this._tapStart.pointerId)?(t&&this.reset(),$.Failed):(this._isValidTap(e)?this._lastTap={center:e.center,timeStamp:e.timeStamp,pointerId:this._tapStart.pointerId}:this._lastTap=null,this._tapStart=null,$.Failed)}_isTapMatch(e,t){return e.timeStamp-t.timeStamp<=this.options.interval&&Al(e.center,t.center)<=this.options.threshold}_isValidTap(e){return e.deltaTime<=this.options.time&&e.distance<=this.options.threshold}_getPointerId(e){return"pointerId"in e.srcEvent?e.srcEvent.pointerId:null}_isSamePointer(e,t){return t===null||this._getPointerId(e)===t}}class Bf extends Il{constructor(e={}){super({enable:!0,event:"tap",pointers:1,taps:1,interval:300,time:250,threshold:9,posThreshold:10,...e}),this.pTime=null,this.pCenter=null,this._timer=null,this._input=null,this.count=0}getTouchAction(){return[Er]}process(e){const{options:t}=this,n=e.pointers.length===t.pointers,s=e.distance<t.threshold,r=e.deltaTime<t.time;if(this.reset(),e.eventType&Z.Start&&this.count===0)return this.failTimeout();if(s&&r&&n){if(e.eventType!==Z.End)return this.failTimeout();const o=this.pTime?e.timeStamp-this.pTime<t.interval:!0,a=!this.pCenter||Al(this.pCenter,e.center)<t.posThreshold;if(this.pTime=e.timeStamp,this.pCenter=e.center,!a||!o?this.count=1:this.count+=1,this._input=e,this.count%t.taps===0)return this.hasRequireFailures()?(this._timer=setTimeout(()=>{this.state=$.Recognized,this.tryEmit(this._input)},t.interval),$.Began):$.Recognized}return $.Failed}failTimeout(){return this._timer=setTimeout(()=>{this.state=$.Failed},this.options.interval),$.Failed}reset(){clearTimeout(this._timer)}emit(e){this.state===$.Recognized&&(e.tapCount=this.count,this.manager.emit(this.options.event,e))}}class Bp extends e3{constructor(){super(...arguments),this.wheelSession=null,this.wheelSessionUnsubscribe=null,this.handleWheelSessionEvent=e=>{e.device==="trackpad"&&this.handleTrackpadEvent(e)}}set(e){const{wheelSession:t,...n}=e;return t&&t!==this.wheelSession&&(this.wheelSessionUnsubscribe?.(),this.wheelSessionUnsubscribe=null,this.wheelSession=t),super.set(n),this.updateWheelSessionSubscription(),this}getTrackpadInput(e,t={}){const{srcEvent:n}=e,s=t.deltaX??e.deltaX,r=t.deltaY??e.deltaY,o=Ml(s,r),a=Math.sqrt(e.deltaX*e.deltaX+e.deltaY*e.deltaY),c=n;return{pointers:[c,c],changedPointers:[c,c],pointerType:"trackpad",srcEvent:c,eventType:e.eventType,timeStamp:e.timeStamp,deltaTime:e.deltaTime,center:e.center,deltaX:s,deltaY:r,angle:Math.atan2(r,s)*180/Math.PI,distance:Math.sqrt(s*s+r*r),distancePerPointer:[a,a],movementDeltaTime:e.deltaTime,scale:1,rotation:0,direction:o,offsetDirection:o,velocity:e.velocity,velocityX:e.velocityX,velocityY:e.velocityY,overallVelocity:e.overallVelocity,overallVelocityX:e.overallVelocityX,overallVelocityY:e.overallVelocityY,maxPointers:2,target:n.target||this.manager.element,additionalEvent:"",...t}}updateWheelSessionSubscription(){const e=!!(this.wheelSession&&this.options.enable&&this.options.trackpad&&this.options.pointers===2);e&&!this.wheelSessionUnsubscribe?this.wheelSessionUnsubscribe=this.wheelSession.on(this.handleWheelSessionEvent):!e&&this.wheelSessionUnsubscribe&&(this.wheelSessionUnsubscribe(),this.wheelSessionUnsubscribe=null)}}const n3=["","start","move","end","cancel","up","down","left","right"];class Df extends Bp{constructor(e={}){super({enable:!0,pointers:1,event:"pan",threshold:10,direction:xe.All,trackpad:!1,coherent:[],...e}),this.trackpadGesture=!1,this.pX=null,this.pY=null}getTouchAction(){const{options:{direction:e}}=this,t=[];return e&xe.Horizontal&&t.push(fc),e&xe.Vertical&&t.push(uc),t}getEventNames(){return n3.map(e=>this.options.event+e)}directionTest(e){const{options:t}=this;let n=!0,{distance:s}=e,{direction:r}=e;const o=e.deltaX,a=e.deltaY;return r&t.direction||(t.direction&xe.Horizontal?(r=o===0?xe.None:o<0?xe.Left:xe.Right,n=o!==this.pX,s=Math.abs(e.deltaX)):(r=a===0?xe.None:a<0?xe.Up:xe.Down,n=a!==this.pY,s=Math.abs(e.deltaY))),e.direction=r,n&&s>t.threshold&&!!(r&t.direction)}attrTest(e){const t=!!(this.state&$.Began),n=!(this.options.coherent?.length&&e.eventType&(Z.End|Z.Cancel));return super.attrTest(e)&&(t||n&&this.coherentTest(e)&&this.directionTest(e))}emit(e){this.pX=e.deltaX,this.pY=e.deltaY;const t=xe[e.direction].toLowerCase();t&&(e.additionalEvent=this.options.event+t),super.emit(e)}handleTrackpadEvent(e){e.isFirst&&(this.trackpadGesture=!e.srcEvent.ctrlKey,!this.trackpadGesture&&this.state&($.Recognized|$.Cancelled|$.Failed)&&(this.state=$.Possible)),this.trackpadGesture&&(this.recognize(this.getTrackpadInput(e,{deltaX:-e.deltaX,deltaY:-e.deltaY,velocity:-e.velocity,velocityX:-e.velocityX,velocityY:-e.velocityY,overallVelocity:-e.overallVelocity,overallVelocityX:-e.overallVelocityX,overallVelocityY:-e.overallVelocityY})),e.isFinal&&(this.trackpadGesture=!1))}}const s3=["","start","move","end","cancel","in","out"];class r3 extends Bp{constructor(e={}){super({enable:!0,event:"pinch",threshold:0,pointers:2,trackpad:!1,coherent:[],...e}),this.trackpadGesture=!1}getTouchAction(){return[js]}getEventNames(){return s3.map(e=>this.options.event+e)}attrTest(e){const t=!!this.options.coherent?.length,n=!!(this.state&$.Began),s=!(t&&e.eventType&(Z.End|Z.Cancel));return super.attrTest(e)&&(n||s&&(t?this.coherentTest(e):Math.abs(e.scale-1)>this.options.threshold))}emit(e){if(e.scale!==1){const t=e.scale<1?"in":"out";e.additionalEvent=this.options.event+t}super.emit(e)}handleTrackpadEvent(e){e.isFirst&&(this.trackpadGesture=e.srcEvent.ctrlKey,!this.trackpadGesture&&this.state&($.Recognized|$.Cancelled|$.Failed)&&(this.state=$.Possible)),this.trackpadGesture&&(this.recognize(this.getTrackpadInput(e,{deltaX:0,deltaY:0,velocity:0,velocityX:0,velocityY:0,overallVelocity:0,overallVelocityX:0,overallVelocityY:0,scale:Math.exp(-e.deltaY/100)})),e.isFinal&&(this.trackpadGesture=!1))}}class eo{constructor(e,t,n){this.element=e,this.callback=t,this.options=n}listen(e,t){t?this.element.addEventListener(e,this.handleEvent,{passive:!1}):this.element.removeEventListener(e,this.handleEvent)}}const o3=typeof navigator<"u"&&navigator.userAgent?navigator.userAgent.toLowerCase():"",a3=o3.indexOf("firefox")!==-1,c3=40,l3=.25;class u3 extends eo{constructor(e,t,n){n.enable=n.enable??!1,super(e,t,n),this.handleEvent=s=>{if(!this.options.enable)return;let r=s.deltaY;globalThis.WheelEvent&&(a3&&s.deltaMode===globalThis.WheelEvent.DOM_DELTA_PIXEL&&(r/=globalThis.devicePixelRatio),s.deltaMode===globalThis.WheelEvent.DOM_DELTA_LINE&&(r*=c3)),s.shiftKey&&r&&(r=r*l3),this.callback({type:"wheel",center:{x:s.clientX,y:s.clientY},delta:-r,device:this.options.wheelSession?.device??"unknown",srcEvent:s,pointerType:"mouse",target:s.target})},n.enable&&(this.wheelSessionUnsubscribe=this.options.wheelSession?.on(()=>{}),this.listen("wheel",!0))}destroy(){this.listen("wheel",!1),this.wheelSessionUnsubscribe?.(),this.wheelSessionUnsubscribe=void 0}enableEventType(e,t){e==="wheel"&&this.options.enable!==t&&(this.options.enable=t,t&&!this.wheelSessionUnsubscribe&&(this.wheelSessionUnsubscribe=this.options.wheelSession?.on(()=>{})),this.listen("wheel",t),t||(this.wheelSessionUnsubscribe?.(),this.wheelSessionUnsubscribe=void 0))}}const f3=4.000244140625,Ff=40,d3=0,h3=1,g3=40,zf=40,p3=120,m3={classificationDelay:32,endDelay:80};class y3{constructor(e,t={}){this.subscriptions=new Map,this.session=null,this.classificationTimer=null,this.endTimer=null,this.pressedControlKeys=new Set,this.listeningForControlKeys=!1,this.handleEvent=n=>{if(!this.hasSubscribers)return"unknown";const s=b3(n,this.pressedControlKeys.size>0);let r=this.session;if(r&&s.timeStamp-r.lastTimeStamp>=this.options.endDelay){if(this.end(),!this.hasSubscribers)return"unknown";r=null}r?(this.scheduleEnd(),this.addSample(r,s)):(r=this.startPendingSession(s),this.scheduleEnd());let{device:o}=r;return o==="unknown"&&(o=Zo(r.samples,!1),o!=="unknown"&&this.begin(r,o)),o},this.finishClassification=()=>{if(this.classificationTimer=null,!this.session||this.session.device!=="unknown")return;const n=this.session,s=Zo(n.samples,!0);this.begin(n,s==="unknown"?"mouse":s)},this.end=()=>{if(!this.session)return;if(this.session.device==="unknown"){const s=this.session,r=Zo(s.samples,!0);this.begin(s,r==="unknown"?"mouse":r)}if(!this.session)return;const n=this.session;this.emit(Z.End,n.lastEvent),this.reset()},this.handleKeyDown=n=>{n.key==="Control"&&this.pressedControlKeys.add(n.code||n.key)},this.handleKeyUp=n=>{n.key==="Control"&&(n.code?this.pressedControlKeys.delete(n.code):this.pressedControlKeys.clear())},this.handleWindowBlur=()=>{this.pressedControlKeys.clear()},this.element=e,this.options={...m3,...t},this.element?.addEventListener("wheel",this.handleEvent,{passive:!0})}get hasSubscribers(){return this.subscriptions.size>0}get device(){return this.session?.device??"unknown"}on(e){const t={listener:e};return this.subscriptions.set(e,t),this.updateControlKeyEventListeners(),()=>{this.subscriptions.get(e)===t&&this.off(e)}}off(e){this.subscriptions.delete(e),this.updateControlKeyEventListeners(),this.hasSubscribers||this.reset()}cancel(){const e=this.session;e&&e.device!=="unknown"&&this.emit(Z.Cancel,e.lastEvent),this.reset()}destroy(){this.cancel(),this.subscriptions.clear(),this.updateControlKeyEventListeners(),this.element?.removeEventListener("wheel",this.handleEvent)}startPendingSession(e){const t={samples:[e],device:"unknown",firstTimeStamp:e.timeStamp,lastTimeStamp:e.timeStamp,totalDeltaX:e.deltaX,totalDeltaY:e.deltaY,velocityX:0,velocityY:0,lastEvent:e.event};return this.session=t,this.classificationTimer=globalThis.setTimeout(this.finishClassification,this.options.classificationDelay),t}addSample(e,t){if(e.samples.push(t),e.lastTimeStamp=t.timeStamp,e.lastEvent=t.event,e.totalDeltaX+=t.deltaX,e.totalDeltaY+=t.deltaY,e.device!=="unknown"){const n=e.samples[e.samples.length-2],s=t.timeStamp-n.timeStamp;e.velocityX=s>0?t.deltaX/s:0,e.velocityY=s>0?t.deltaY/s:0,this.emit(Z.Move,t.event,{velocityX:e.velocityX,velocityY:e.velocityY})}}begin(e,t){e.device=t,this.clearClassificationTimer(),this.emit(Z.Start,e.samples[0].event);const n=e.lastTimeStamp-e.firstTimeStamp;e.velocityX=n>0?e.totalDeltaX/n:0,e.velocityY=n>0?e.totalDeltaY/n:0,this.emit(Z.Move,e.lastEvent,{velocityX:e.velocityX,velocityY:e.velocityY})}scheduleEnd(){this.clearEndTimer(),this.endTimer=globalThis.setTimeout(this.end,this.options.endDelay)}emit(e,t,n){const s=this.session;if(!s||s.device==="unknown")return;const r=e===Z.Start,o=e===Z.End||e===Z.Cancel,a=r?s.firstTimeStamp:s.lastTimeStamp,c=r?0:Math.max(0,a-s.firstTimeStamp),l=r?0:s.totalDeltaX,u=r?0:s.totalDeltaY,f=c>0?l/c:0,d=c>0?u/c:0,h=r?0:n?.velocityX??s.velocityX,g=r?0:n?.velocityY??s.velocityY,p={eventType:e,device:s.device,srcEvent:t,timeStamp:a,center:{x:t.clientX,y:t.clientY},deltaX:l,deltaY:u,deltaTime:c,velocity:Math.abs(h)>Math.abs(g)?h:g,velocityX:h,velocityY:g,overallVelocity:Math.abs(f)>Math.abs(d)?f:d,overallVelocityX:f,overallVelocityY:d,isFirst:r,isFinal:o};for(const{listener:m}of[...this.subscriptions.values()])m(p)}reset(){this.clearClassificationTimer(),this.clearEndTimer(),this.session=null}clearClassificationTimer(){this.classificationTimer!==null&&(globalThis.clearTimeout(this.classificationTimer),this.classificationTimer=null)}clearEndTimer(){this.endTimer!==null&&(globalThis.clearTimeout(this.endTimer),this.endTimer=null)}updateControlKeyEventListeners(){const e=this.hasSubscribers,t=_3();!t||e===this.listeningForControlKeys||(this.listeningForControlKeys=e,e?(t.addEventListener("keydown",this.handleKeyDown,!0),t.addEventListener("keyup",this.handleKeyUp,!0),t.addEventListener("blur",this.handleWindowBlur)):(t.removeEventListener("keydown",this.handleKeyDown,!0),t.removeEventListener("keyup",this.handleKeyUp,!0),t.removeEventListener("blur",this.handleWindowBlur),this.pressedControlKeys.clear()))}}function _3(){return typeof window<"u"?window:globalThis.document?.defaultView}function b3(i,e){let t=i.deltaX,n=i.deltaY;return i.deltaMode===h3&&(t*=Ff,n*=Ff),{event:i,timeStamp:i.timeStamp,deltaX:t,deltaY:n,isControlKeyDown:e}}function Zo(i,e){return i.some(({event:t,isControlKeyDown:n})=>t.ctrlKey&&!n)?"trackpad":i.some(({event:t})=>t.deltaMode!==d3)||i.some(v3)||i.every(({event:t})=>{const n=t.wheelDelta;return n!==void 0&&Math.abs(n)%40===0})?"mouse":i.some(({deltaX:t})=>t!==0)||i.length>1&&x3(i)?"trackpad":e?"mouse":"unknown"}function v3({event:i,deltaX:e,deltaY:t}){if(e!==0||t===0)return!1;const n=Math.abs(t/f3);if(Number.isInteger(n))return!0;const s=i.wheelDelta;return typeof s=="number"&&s!==0&&s%p3===0}function x3(i){for(let e=0;e<i.length;e++){const t=i[e];if(Math.abs(t.deltaX)>zf||Math.abs(t.deltaY)>zf||e>0&&t.timeStamp-i[e-1].timeStamp>g3)return!1}return!0}const Nf=["mousedown","mousemove","mouseup","mouseover","mouseout","mouseenter","mouseleave"];class w3 extends eo{constructor(e,t,n){super(e,t,{enable:!0,...n}),this.handleEvent=r=>{this.handleOverEvent(r),this.handleOutEvent(r),this.handleEnterEvent(r),this.handleLeaveEvent(r),this.handleMoveEvent(r)},this.pressed=!1;const{enable:s=!1}=this.options;this.enableMoveEvent=s,this.enableLeaveEvent=s,this.enableEnterEvent=s,this.enableOutEvent=s,this.enableOverEvent=s,s&&Nf.forEach(r=>this.listen(r,!0))}destroy(){Nf.forEach(e=>this.listen(e,!1))}enableEventType(e,t){switch(e){case"pointermove":this.enableMoveEvent!==t&&(this.enableMoveEvent=t,this.listen("mousedown",t),this.listen("mousemove",t),this.listen("mouseup",t));break;case"pointerover":this.enableOverEvent!==t&&(this.enableOverEvent=t,this.listen("mouseover",t));break;case"pointerout":this.enableOutEvent!==t&&(this.enableOutEvent=t,this.listen("mouseout",t));break;case"pointerenter":this.enableEnterEvent!==t&&(this.enableEnterEvent=t,this.listen("mouseenter",t));break;case"pointerleave":this.enableLeaveEvent!==t&&(this.enableLeaveEvent=t,this.listen("mouseleave",t));break}}handleOverEvent(e){this.enableOverEvent&&e.type==="mouseover"&&this._emit("pointerover",e)}handleOutEvent(e){this.enableOutEvent&&e.type==="mouseout"&&this._emit("pointerout",e)}handleEnterEvent(e){this.enableEnterEvent&&e.type==="mouseenter"&&this._emit("pointerenter",e)}handleLeaveEvent(e){this.enableLeaveEvent&&e.type==="mouseleave"&&this._emit("pointerleave",e)}handleMoveEvent(e){if(this.enableMoveEvent)switch(e.type){case"mousedown":e.button>=0&&(this.pressed=!0);break;case"mousemove":e.buttons===0&&(this.pressed=!1),this.pressed||this._emit("pointermove",e);break;case"mouseup":this.pressed=!1;break}}_emit(e,t){this.callback({type:e,center:{x:t.clientX,y:t.clientY},srcEvent:t,pointerType:"mouse",target:t.target})}}const Uf=["keydown","keyup"];class P3 extends eo{constructor(e,t,n){super(e,t,{enable:!0,tabIndex:0,...n}),this.handleEvent=r=>{const o=r.target||r.srcElement;o.tagName==="INPUT"&&o.type==="text"||o.tagName==="TEXTAREA"||(this.enableDownEvent&&r.type==="keydown"&&this.callback({type:"keydown",srcEvent:r,key:r.key,target:r.target}),this.enableUpEvent&&r.type==="keyup"&&this.callback({type:"keyup",srcEvent:r,key:r.key,target:r.target}))};const{enable:s=!1}=this.options;this.enableDownEvent=s,this.enableUpEvent=s,e.tabIndex=this.options.tabIndex,e.style.outline="none",s&&Uf.forEach(r=>this.listen(r,!0))}destroy(){Uf.forEach(e=>this.listen(e,!1))}enableEventType(e,t){e==="keydown"&&this.enableDownEvent!==t&&(this.enableDownEvent=t,this.listen(e,t)),e==="keyup"&&this.enableUpEvent!==t&&(this.enableUpEvent=t,this.listen(e,t))}}class S3 extends eo{constructor(e,t,n){n.enable=n.enable??!1,super(e,t,n),this.handleEvent=s=>{this.options.enable&&this.callback({type:"contextmenu",center:{x:s.clientX,y:s.clientY},srcEvent:s,pointerType:"mouse",target:s.target})},n.enable&&this.listen("contextmenu",!0)}destroy(){this.listen("contextmenu",!1)}enableEventType(e,t){e==="contextmenu"&&this.options.enable!==t&&(this.options.enable=t,this.listen("contextmenu",t))}}const $f=1,gc=2,Gf=4,E3={pointerdown:$f,pointermove:gc,pointerup:Gf,mousedown:$f,mousemove:gc,mouseup:Gf},C3=0,L3=1,T3=2,A3=1,M3=2,I3=4;function R3(i){const e=E3[i.srcEvent.type];if(!e)return null;const{buttons:t,button:n}=i.srcEvent;let s=!1,r=!1,o=!1;return e===gc?(s=!!(t&A3),r=!!(t&I3),o=!!(t&M3)):(s=n===C3,r=n===L3,o=n===T3),{leftButton:s,middleButton:r,rightButton:o}}function O3(i,e){const t=i.center;if(!t)return null;const n=e.getBoundingClientRect(),s=n.width/e.offsetWidth||1,r=n.height/e.offsetHeight||1,o={x:(t.x-n.left-e.clientLeft)/s,y:(t.y-n.top-e.clientTop)/r};return{center:t,offsetCenter:o}}const k3={srcElement:"root",priority:0};class B3{constructor(e,t){this.handleEvent=n=>{if(this.isEmpty())return;const s=this._normalizeEvent(n);let r=n.srcEvent.target;for(;r&&r!==s.rootElement;){if(this._emit(s,r),s.handled)return;r=r.parentNode}this._emit(s,"root")},this.eventManager=e,this.recognizerName=t,this.handlers=[],this.handlersByElement=new Map,this._active=!1}isEmpty(){return!this._active}add(e,t,n,s=!1,r=!1){const{handlers:o,handlersByElement:a}=this,c={...k3,...n};let l=a.get(c.srcElement);l||(l=[],a.set(c.srcElement,l));const u={type:e,handler:t,srcElement:c.srcElement,priority:c.priority};s&&(u.once=!0),r&&(u.passive=!0),o.push(u),this._active=this._active||!u.passive;let f=l.length-1;for(;f>=0&&!(l[f].priority>=u.priority);)f--;l.splice(f+1,0,u)}remove(e,t){const{handlers:n,handlersByElement:s}=this;for(let r=n.length-1;r>=0;r--){const o=n[r];if(o.type===e&&o.handler===t){n.splice(r,1);const a=s.get(o.srcElement);a.splice(a.indexOf(o),1),a.length===0&&s.delete(o.srcElement)}}this._active=n.some(r=>!r.passive)}_emit(e,t){const n=this.handlersByElement.get(t);if(n){let s=!1;const r=()=>{e.handled=!0},o=()=>{e.handled=!0,s=!0},a=[];for(let c=0;c<n.length;c++){const{type:l,handler:u,once:f}=n[c];if(u({...e,type:l,stopPropagation:r,stopImmediatePropagation:o}),f&&a.push(n[c]),s)break}for(let c=0;c<a.length;c++){const{type:l,handler:u}=a[c];this.remove(l,u)}}}_normalizeEvent(e){const t=this.eventManager.getElement();return{...e,...R3(e),...O3(e,t),preventDefault:()=>{e.srcEvent.preventDefault()},stopImmediatePropagation:null,stopPropagation:null,handled:!1,rootElement:t}}}function D3(i){if("recognizer"in i)return i;let e;const t=Array.isArray(i)?[...i]:[i];if(typeof t[0]=="function"){const n=t.shift(),s=t.shift()||{};e=new n(s)}else e=t.shift();return{recognizer:e,recognizeWith:typeof t[0]=="string"?[t[0]]:t[0],requireFailure:typeof t[1]=="string"?[t[1]]:t[1]}}class F3{constructor(e=null,t={}){if(this._onBasicInput=n=>{this.manager.emit(n.srcEvent.type,n)},this._onOtherEvent=n=>{this.manager.emit(n.type,n)},this.options={recognizers:[],events:{},touchAction:"compute",tabIndex:0,cssProps:{},...t},this.events=new Map,this.element=e,this.wheelSession=new y3(e),!!e){this.manager=new ZS(e,this.options);for(const n of this.options.recognizers){const{recognizer:s,recognizeWith:r,requireFailure:o}=D3(n);this.manager.add(s),r&&s.recognizeWith(r),o&&s.requireFailure(o)}this.manager.on("hammer.input",this._onBasicInput),this.wheelInput=new u3(e,this._onOtherEvent,{enable:!1,wheelSession:this.wheelSession}),this.moveInput=new w3(e,this._onOtherEvent,{enable:!1}),this.keyInput=new P3(e,this._onOtherEvent,{enable:!1,tabIndex:t.tabIndex}),this.contextmenuInput=new S3(e,this._onOtherEvent,{enable:!1}),this.on(this.options.events)}}getElement(){return this.element}destroy(){if(!this.element){this.wheelSession.destroy();return}this.wheelInput.destroy(),this.wheelSession.destroy(),this.moveInput.destroy(),this.keyInput.destroy(),this.contextmenuInput.destroy(),this.manager.destroy()}on(e,t,n){this._addEventHandler(e,t,n,!1)}once(e,t,n){this._addEventHandler(e,t,n,!0)}watch(e,t,n){this._addEventHandler(e,t,n,!1,!0)}off(e,t){this._removeEventHandler(e,t)}emit(e){this.manager?.emit(e.type,e)}_toggleRecognizer(e,t){const{manager:n}=this;if(!n)return;const s=n.get(e);s&&(s.set({enable:t,wheelSession:this.wheelSession}),n.touchAction.update()),this.wheelInput?.enableEventType(e,t),this.moveInput?.enableEventType(e,t),this.keyInput?.enableEventType(e,t),this.contextmenuInput?.enableEventType(e,t)}_addEventHandler(e,t,n,s,r){if(typeof e!="string"){n=t;for(const[l,u]of Object.entries(e))this._addEventHandler(l,u,n,s,r);return}const{manager:o,events:a}=this;if(!o)return;let c=a.get(e);if(!c){const l=this._getRecognizerName(e)||e;c=new B3(this,l),a.set(e,c),o&&o.on(e,c.handleEvent)}c.add(e,t,n,s,r),c.isEmpty()||this._toggleRecognizer(c.recognizerName,!0)}_removeEventHandler(e,t){if(typeof e!="string"){for(const[r,o]of Object.entries(e))this._removeEventHandler(r,o);return}const{events:n}=this,s=n.get(e);if(s&&(s.remove(e,t),s.isEmpty())){const{recognizerName:r}=s;let o=!1;for(const a of n.values())if(a.recognizerName===r&&!a.isEmpty()){o=!0;break}o||this._toggleRecognizer(r,!1)}}_getRecognizerName(e){return this.manager.recognizers.find(t=>t.getEventNames().includes(e))?.options.event}}const Re={WEB_MERCATOR:1,GLOBE:2,WEB_MERCATOR_AUTO_OFFSET:4,IDENTITY:0},_t={common:0,meters:1,pixels:2},Ws={click:"onClick",dblclick:"onClick",panstart:"onDragStart",panmove:"onDrag",panend:"onDragEnd"},Vf={multipan:[Df,{threshold:10,pointers:2,trackpad:!0}],pinch:[r3,{trackpad:!0},null,["multipan"]],pan:[Df,{threshold:1},["pinch"],["multipan"]],dblclick:[Bf,{event:"dblclick",taps:2,enable:!1}],dblclickdrag:[i3,{event:"dblclickdrag",enable:!1},["dblclick"],null],click:[Bf,{event:"click"},["dblclickdrag"],["dblclick","dblclickdrag"]]};function z3(i,e){if(i===e)return!0;if(Array.isArray(i)){const t=i.length;if(!e||e.length!==t)return!1;for(let n=0;n<t;n++)if(i[n]!==e[n])return!1;return!0}return!1}function ss(i){let e={},t;return n=>{for(const s in n)if(!z3(n[s],e[s])){t=i(n),e=n;break}return t}}const jf=[0,0,0,0],N3=[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,0],Dp=[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1],U3=[0,0,0],Fp=[0,0,0],$3={default:-1,cartesian:0,lnglat:1,"meter-offsets":2,"lnglat-offsets":3};function to(i){const e=$3[i];if(e===void 0)throw new Error(`Invalid coordinateSystem: ${i}`);return e}const G3=ss(W3);function zp(i,e,t=Fp){t.length<3&&(t=[t[0],t[1],0]);let n=t,s,r=!0;switch(e==="lnglat-offsets"||e==="meter-offsets"?s=t:s=i.isGeospatial?[Math.fround(i.longitude),Math.fround(i.latitude),0]:null,i.projectionMode){case Re.WEB_MERCATOR:(e==="lnglat"||e==="cartesian")&&(s=[0,0,0],r=!1);break;case Re.WEB_MERCATOR_AUTO_OFFSET:e==="lnglat"?n=s:e==="cartesian"&&(n=[Math.fround(i.center[0]),Math.fround(i.center[1]),0],s=i.unprojectPosition(n),n[0]-=t[0],n[1]-=t[1],n[2]-=t[2]);break;case Re.IDENTITY:n=i.position.map(Math.fround),n[2]=n[2]||0;break;case Re.GLOBE:r=!1,s=null;break;default:r=!1}return{geospatialOrigin:s,shaderCoordinateOrigin:n,offsetMode:r}}function V3(i,e,t){const{viewMatrixUncentered:n,projectionMatrix:s}=i;let{viewMatrix:r,viewProjectionMatrix:o}=i,a=jf,c=jf,l=i.cameraPosition;const{geospatialOrigin:u,shaderCoordinateOrigin:f,offsetMode:d}=zp(i,e,t);return d&&(c=i.projectPosition(u||f),l=[l[0]-c[0],l[1]-c[1],l[2]-c[2]],c[3]=1,a=rn([],c,o),r=n||r,o=si([],s,r),o=si([],o,N3)),{viewMatrix:r,viewProjectionMatrix:o,projectionCenter:a,originCommon:c,cameraPosCommon:l,shaderCoordinateOrigin:f,geospatialOrigin:u}}function j3({viewport:i,devicePixelRatio:e=1,modelMatrix:t=null,coordinateSystem:n="default",coordinateOrigin:s=Fp,autoWrapLongitude:r=!1}){n==="default"&&(n=i.isGeospatial?"lnglat":"cartesian");const o=G3({viewport:i,devicePixelRatio:e,coordinateSystem:n,coordinateOrigin:s});return o.wrapLongitude=r,o.modelMatrix=t||Dp,o}function W3({viewport:i,devicePixelRatio:e,coordinateSystem:t,coordinateOrigin:n}){const{projectionCenter:s,viewProjectionMatrix:r,originCommon:o,cameraPosCommon:a,shaderCoordinateOrigin:c,geospatialOrigin:l}=V3(i,t,n),u=i.getDistanceScales(),f=[i.width*e,i.height*e],d=rn([],[0,0,-i.focalDistance,1],i.projectionMatrix)[3]||1,h={coordinateSystem:to(t),projectionMode:i.projectionMode,coordinateOrigin:c,commonOrigin:o.slice(0,3),center:s,pseudoMeters:!!i._pseudoMeters,viewportSize:f,devicePixelRatio:e,focalDistance:d,commonUnitsPerMeter:u.unitsPerMeter,commonUnitsPerWorldUnit:u.unitsPerMeter,commonUnitsPerWorldUnit2:U3,scale:i.scale,wrapLongitude:!1,viewProjectionMatrix:r,modelMatrix:Dp,cameraPosition:a};if(l){const g=i.getDistanceScales(l);switch(t){case"meter-offsets":h.commonUnitsPerWorldUnit=g.unitsPerMeter,h.commonUnitsPerWorldUnit2=g.unitsPerMeter2;break;case"lnglat":case"lnglat-offsets":i._pseudoMeters||(h.commonUnitsPerMeter=g.unitsPerMeter),h.commonUnitsPerWorldUnit=g.unitsPerDegree,h.commonUnitsPerWorldUnit2=g.unitsPerDegree2;break;case"cartesian":h.commonUnitsPerWorldUnit=[1,1,g.unitsPerMeter[2]],h.commonUnitsPerWorldUnit2=[0,0,g.unitsPerMeter2[2]];break}}if(i.projectionMode===Re.GLOBE&&t==="meter-offsets"){const m=n[0]*Math.PI/180,_=n[1]*Math.PI/180,v=Math.cos(_),b=((n[2]||0)/6370972+1)*256;h.commonOrigin=[Math.sin(m)*v*b,-Math.cos(m)*v*b,Math.sin(_)*b]}return h}const H3=["default","lnglat","meter-offsets","lnglat-offsets","cartesian"],Y3=H3.map(i=>`const COORDINATE_SYSTEM_${i.toUpperCase().replaceAll("-","_")}: i32 = ${to(i)};`).join(""),q3=Object.keys(Re).map(i=>`const PROJECTION_MODE_${i}: i32 = ${Re[i]};`).join(""),Z3=Object.keys(_t).map(i=>`const UNIT_${i.toUpperCase()}: i32 = ${_t[i]};`).join(""),X3=`${Y3}
${q3}
${Z3}

const TILE_SIZE: f32 = 512.0;
const PI: f32 = 3.1415926536;
const WORLD_SCALE: f32 = TILE_SIZE / (PI * 2.0);
const ZERO_64_LOW: vec3<f32> = vec3<f32>(0.0, 0.0, 0.0);
const EARTH_RADIUS: f32 = 6370972.0; // meters
const GLOBE_RADIUS: f32 = 256.0;

// -----------------------------------------------------------------------------
// Uniform block (converted from GLSL uniform block)
// -----------------------------------------------------------------------------
struct ProjectUniforms {
  wrapLongitude: i32,
  coordinateSystem: i32,
  commonUnitsPerMeter: vec3<f32>,
  projectionMode: i32,
  scale: f32,
  commonUnitsPerWorldUnit: vec3<f32>,
  commonUnitsPerWorldUnit2: vec3<f32>,
  center: vec4<f32>,
  modelMatrix: mat4x4<f32>,
  viewProjectionMatrix: mat4x4<f32>,
  viewportSize: vec2<f32>,
  devicePixelRatio: f32,
  focalDistance: f32,
  cameraPosition: vec3<f32>,
  coordinateOrigin: vec3<f32>,
  commonOrigin: vec3<f32>,
  pseudoMeters: i32,
};

@group(0) @binding(auto)
var<uniform> project: ProjectUniforms;

// -----------------------------------------------------------------------------
// Geometry data shared across the project helpers.
// The active layer shader is responsible for populating this private module
// state before calling the project functions below.
// -----------------------------------------------------------------------------

// Structure to carry additional geometry data used by deck.gl filters.
struct Geometry {
  worldPosition: vec3<f32>,
  worldPositionAlt: vec3<f32>,
  position: vec4<f32>,
  normal: vec3<f32>,
  uv: vec2<f32>,
  pickingColor: vec3<f32>,
};

var<private> geometry: Geometry;
`,K3=`${X3}

// -----------------------------------------------------------------------------
// Functions
// -----------------------------------------------------------------------------

// Returns an adjustment factor for commonUnitsPerMeter
fn _project_size_at_latitude(lat: f32) -> f32 {
  let y = clamp(lat, -89.9, 89.9);
  return 1.0 / cos(radians(y));
}

// Overloaded version: scales a value in meters at a given latitude.
fn _project_size_at_latitude_m(meters: f32, lat: f32) -> f32 {
  return meters * project.commonUnitsPerMeter.z * _project_size_at_latitude(lat);
}

// Computes a non-linear scale factor based on geometry.
// (Note: This function relies on "geometry" being provided.)
fn project_size() -> f32 {
  if (project.projectionMode == PROJECTION_MODE_WEB_MERCATOR &&
      project.coordinateSystem == COORDINATE_SYSTEM_LNGLAT &&
      project.pseudoMeters == 0) {
    if (geometry.position.w == 0.0) {
      return _project_size_at_latitude(geometry.worldPosition.y);
    }
    let y: f32 = geometry.position.y / TILE_SIZE * 2.0 - 1.0;
    let y2 = y * y;
    let y4 = y2 * y2;
    let y6 = y4 * y2;
    return 1.0 + 4.9348 * y2 + 4.0587 * y4 + 1.5642 * y6;
  }
  return 1.0;
}

// Overloads to scale offsets (meters to world units)
fn project_size_float(meters: f32) -> f32 {
  return meters * project.commonUnitsPerMeter.z * project_size();
}

fn project_size_vec2(meters: vec2<f32>) -> vec2<f32> {
  return meters * project.commonUnitsPerMeter.xy * project_size();
}

fn project_size_vec3(meters: vec3<f32>) -> vec3<f32> {
  return meters * project.commonUnitsPerMeter * project_size();
}

fn project_size_vec4(meters: vec4<f32>) -> vec4<f32> {
  return vec4<f32>(meters.xyz * project.commonUnitsPerMeter, meters.w);
}

// Returns a rotation matrix aligning the z‑axis with the given up vector.
fn project_get_orientation_matrix(up: vec3<f32>) -> mat3x3<f32> {
  let uz = normalize(up);
  let ux = select(
    vec3<f32>(1.0, 0.0, 0.0),
    normalize(vec3<f32>(uz.y, -uz.x, 0.0)),
    abs(uz.z) == 1.0
  );
  let uy = cross(uz, ux);
  return mat3x3<f32>(ux, uy, uz);
}

// Since WGSL does not support "out" parameters, we return a struct.
struct RotationResult {
  needsRotation: bool,
  transform: mat3x3<f32>,
};

fn project_needs_rotation(commonPosition: vec3<f32>) -> RotationResult {
  if (project.projectionMode == PROJECTION_MODE_GLOBE) {
    return RotationResult(true, project_get_orientation_matrix(commonPosition));
  } else {
    return RotationResult(false, mat3x3<f32>());  // identity alternative if needed
  };
}

// Projects a normal vector from the current coordinate system to world space.
fn project_normal(vector: vec3<f32>) -> vec3<f32> {
  let normal_modelspace = project.modelMatrix * vec4<f32>(vector, 0.0);
  var n = normalize(normal_modelspace.xyz * project.commonUnitsPerMeter);
  let rotResult = project_needs_rotation(geometry.position.xyz);
  if (rotResult.needsRotation) {
    n = rotResult.transform * n;
  }
  return n;
}

// Applies a scale offset based on y-offset (dy)
fn project_offset_(offset: vec4<f32>) -> vec4<f32> {
  let dy: f32 = offset.y;
  let commonUnitsPerWorldUnit = project.commonUnitsPerWorldUnit + project.commonUnitsPerWorldUnit2 * dy;
  return vec4<f32>(offset.xyz * commonUnitsPerWorldUnit, offset.w);
}

// Projects lng/lat coordinates to a unit tile [0,1]
fn project_mercator_(lnglat: vec2<f32>) -> vec2<f32> {
  var x = lnglat.x;
  if (project.wrapLongitude != 0) {
    x = ((x + 180.0) % 360.0) - 180.0;
  }
  let y = clamp(lnglat.y, -89.9, 89.9);
  return vec2<f32>(
    radians(x) + PI,
    PI + log(tan_fp32(PI * 0.25 + radians(y) * 0.5))
  ) * WORLD_SCALE;
}

// Projects lng/lat/z coordinates for a globe projection.
fn project_globe_(lnglatz: vec3<f32>) -> vec3<f32> {
  let lambda = radians(lnglatz.x);
  let phi = radians(lnglatz.y);
  let cosPhi = cos(phi);
  let D = (lnglatz.z / EARTH_RADIUS + 1.0) * GLOBE_RADIUS;
  return vec3<f32>(
    sin(lambda) * cosPhi,
    -cos(lambda) * cosPhi,
    sin(phi)
  ) * D;
}

// Projects positions (with an optional 64-bit low part) from the input
// coordinate system to the common space.
fn project_position_vec4_f64(position: vec4<f32>, position64Low: vec3<f32>) -> vec4<f32> {
  var position_world = project.modelMatrix * position;

  // Work around for a Mac+NVIDIA bug:
  if (project.projectionMode == PROJECTION_MODE_WEB_MERCATOR) {
    if (project.coordinateSystem == COORDINATE_SYSTEM_LNGLAT) {
      return vec4<f32>(
        project_mercator_(position_world.xy),
        _project_size_at_latitude_m(position_world.z, position_world.y),
        position_world.w
      );
    }
    if (project.coordinateSystem == COORDINATE_SYSTEM_CARTESIAN) {
      position_world = vec4f(position_world.xyz + project.coordinateOrigin, position_world.w);
    }
  }
  if (project.projectionMode == PROJECTION_MODE_GLOBE) {
    if (project.coordinateSystem == COORDINATE_SYSTEM_LNGLAT) {
      return vec4<f32>(
        project_globe_(position_world.xyz),
        position_world.w
      );
    }
    if (project.coordinateSystem == COORDINATE_SYSTEM_METER_OFFSETS) {
      let enuMatrix = project_get_orientation_matrix(project.commonOrigin);
      let metersToCommon = GLOBE_RADIUS / EARTH_RADIUS;
      let offsetCommon = (enuMatrix * vec3<f32>(-position_world.x, -position_world.y, position_world.z)) * metersToCommon;
      return vec4<f32>(project.commonOrigin + offsetCommon, position_world.w);
    }
  }
  if (project.projectionMode == PROJECTION_MODE_WEB_MERCATOR_AUTO_OFFSET) {
    if (project.coordinateSystem == COORDINATE_SYSTEM_LNGLAT) {
      if (abs(position_world.y - project.coordinateOrigin.y) > 0.25) {
        return vec4<f32>(
          project_mercator_(position_world.xy) - project.commonOrigin.xy,
          project_size_float(position_world.z),
          position_world.w
        );
      }
    }
  }
  if (project.projectionMode == PROJECTION_MODE_IDENTITY ||
      (project.projectionMode == PROJECTION_MODE_WEB_MERCATOR_AUTO_OFFSET &&
       (project.coordinateSystem == COORDINATE_SYSTEM_LNGLAT ||
        project.coordinateSystem == COORDINATE_SYSTEM_CARTESIAN))) {
    position_world = vec4f(position_world.xyz - project.coordinateOrigin, position_world.w);
  }

  return project_offset_(position_world) +
         project_offset_(project.modelMatrix * vec4<f32>(position64Low, 0.0));
}

// Overloaded versions for different input types.
fn project_position_vec4_f32(position: vec4<f32>) -> vec4<f32> {
  return project_position_vec4_f64(position, ZERO_64_LOW);
}

fn project_position_vec3_f64(position: vec3<f32>, position64Low: vec3<f32>) -> vec3<f32> {
  let projected_position = project_position_vec4_f64(vec4<f32>(position, 1.0), position64Low);
  return projected_position.xyz;
}

fn project_position_vec3_f32(position: vec3<f32>) -> vec3<f32> {
  let projected_position = project_position_vec4_f64(vec4<f32>(position, 1.0), ZERO_64_LOW);
  return projected_position.xyz;
}

fn project_position_vec2_f32(position: vec2<f32>) -> vec2<f32> {
  let projected_position = project_position_vec4_f64(vec4<f32>(position, 0.0, 1.0), ZERO_64_LOW);
  return projected_position.xy;
}

// Transforms a common space position to clip space.
fn project_common_position_to_clipspace_with_projection(position: vec4<f32>, viewProjectionMatrix: mat4x4<f32>, center: vec4<f32>) -> vec4<f32> {
  var clipPosition = viewProjectionMatrix * position + center;
  // deck.gl projection matrices use WebGL's [-w, w] depth range; WebGPU clips z to [0, w].
  clipPosition.z = (clipPosition.z + clipPosition.w) * 0.5;
  return clipPosition;
}

// Uses the project viewProjectionMatrix and center.
fn project_common_position_to_clipspace(position: vec4<f32>) -> vec4<f32> {
  return project_common_position_to_clipspace_with_projection(position, project.viewProjectionMatrix, project.center);
}

// Returns a clip space offset corresponding to a given number of screen pixels.
fn project_pixel_size_to_clipspace(pixels: vec2<f32>) -> vec2<f32> {
  let offset = pixels / project.viewportSize * project.devicePixelRatio * 2.0;
  return offset * project.focalDistance;
}

fn project_meter_size_to_pixel(meters: f32) -> f32 {
  return project_size_float(meters) * project.scale;
}

fn project_unit_size_to_pixel(size: f32, unit: i32) -> f32 {
  if (unit == UNIT_METERS) {
    return project_meter_size_to_pixel(size);
  } else if (unit == UNIT_COMMON) {
    return size * project.scale;
  }
  // UNIT_PIXELS: no scaling applied.
  return size;
}

fn project_pixel_size_float(pixels: f32) -> f32 {
  return pixels / project.scale;
}

fn project_pixel_size_vec2(pixels: vec2<f32>) -> vec2<f32> {
  return pixels / project.scale;
}
`,Q3=["default","lnglat","meter-offsets","lnglat-offsets","cartesian"],J3=Q3.map(i=>`const int COORDINATE_SYSTEM_${i.toUpperCase().replaceAll("-","_")} = ${to(i)};`).join(""),eE=Object.keys(Re).map(i=>`const int PROJECTION_MODE_${i} = ${Re[i]};`).join(""),tE=Object.keys(_t).map(i=>`const int UNIT_${i.toUpperCase()} = ${_t[i]};`).join(""),iE=`${J3}
${eE}
${tE}
layout(std140) uniform projectUniforms {
bool wrapLongitude;
int coordinateSystem;
vec3 commonUnitsPerMeter;
int projectionMode;
float scale;
vec3 commonUnitsPerWorldUnit;
vec3 commonUnitsPerWorldUnit2;
vec4 center;
mat4 modelMatrix;
mat4 viewProjectionMatrix;
vec2 viewportSize;
float devicePixelRatio;
float focalDistance;
vec3 cameraPosition;
vec3 coordinateOrigin;
vec3 commonOrigin;
bool pseudoMeters;
} project;
const float TILE_SIZE = 512.0;
const float PI = 3.1415926536;
const float WORLD_SCALE = TILE_SIZE / (PI * 2.0);
const vec3 ZERO_64_LOW = vec3(0.0);
const float EARTH_RADIUS = 6370972.0;
const float GLOBE_RADIUS = 256.0;
float project_size_at_latitude(float lat) {
float y = clamp(lat, -89.9, 89.9);
return 1.0 / cos(radians(y));
}
float project_size() {
if (project.projectionMode == PROJECTION_MODE_WEB_MERCATOR &&
project.coordinateSystem == COORDINATE_SYSTEM_LNGLAT &&
project.pseudoMeters == false) {
if (geometry.position.w == 0.0) {
return project_size_at_latitude(geometry.worldPosition.y);
}
float y = geometry.position.y / TILE_SIZE * 2.0 - 1.0;
float y2 = y * y;
float y4 = y2 * y2;
float y6 = y4 * y2;
return 1.0 + 4.9348 * y2 + 4.0587 * y4 + 1.5642 * y6;
}
return 1.0;
}
float project_size_at_latitude(float meters, float lat) {
return meters * project.commonUnitsPerMeter.z * project_size_at_latitude(lat);
}
float project_size(float meters) {
return meters * project.commonUnitsPerMeter.z * project_size();
}
vec2 project_size(vec2 meters) {
return meters * project.commonUnitsPerMeter.xy * project_size();
}
vec3 project_size(vec3 meters) {
return meters * project.commonUnitsPerMeter * project_size();
}
vec4 project_size(vec4 meters) {
return vec4(meters.xyz * project.commonUnitsPerMeter, meters.w);
}
mat3 project_get_orientation_matrix(vec3 up) {
vec3 uz = normalize(up);
vec3 ux = abs(uz.z) == 1.0 ? vec3(1.0, 0.0, 0.0) : normalize(vec3(uz.y, -uz.x, 0));
vec3 uy = cross(uz, ux);
return mat3(ux, uy, uz);
}
bool project_needs_rotation(vec3 commonPosition, out mat3 transform) {
if (project.projectionMode == PROJECTION_MODE_GLOBE) {
transform = project_get_orientation_matrix(commonPosition);
return true;
}
return false;
}
vec3 project_normal(vec3 vector) {
vec4 normal_modelspace = project.modelMatrix * vec4(vector, 0.0);
vec3 n = normalize(normal_modelspace.xyz * project.commonUnitsPerMeter);
mat3 rotation;
if (project_needs_rotation(geometry.position.xyz, rotation)) {
n = rotation * n;
}
return n;
}
vec4 project_offset_(vec4 offset) {
float dy = offset.y;
vec3 commonUnitsPerWorldUnit = project.commonUnitsPerWorldUnit + project.commonUnitsPerWorldUnit2 * dy;
return vec4(offset.xyz * commonUnitsPerWorldUnit, offset.w);
}
vec2 project_mercator_(vec2 lnglat) {
float x = lnglat.x;
if (project.wrapLongitude) {
x = mod(x + 180., 360.0) - 180.;
}
float y = clamp(lnglat.y, -89.9, 89.9);
return vec2(
radians(x) + PI,
PI + log(tan_fp32(PI * 0.25 + radians(y) * 0.5))
) * WORLD_SCALE;
}
vec3 project_globe_(vec3 lnglatz) {
float lambda = radians(lnglatz.x);
float phi = radians(lnglatz.y);
float cosPhi = cos(phi);
float D = (lnglatz.z / EARTH_RADIUS + 1.0) * GLOBE_RADIUS;
return vec3(
sin(lambda) * cosPhi,
-cos(lambda) * cosPhi,
sin(phi)
) * D;
}
vec4 project_position(vec4 position, vec3 position64Low) {
vec4 position_world = project.modelMatrix * position;
if (project.projectionMode == PROJECTION_MODE_WEB_MERCATOR) {
if (project.coordinateSystem == COORDINATE_SYSTEM_LNGLAT) {
return vec4(
project_mercator_(position_world.xy),
project_size_at_latitude(position_world.z, position_world.y),
position_world.w
);
}
if (project.coordinateSystem == COORDINATE_SYSTEM_CARTESIAN) {
position_world.xyz += project.coordinateOrigin;
}
}
if (project.projectionMode == PROJECTION_MODE_GLOBE) {
if (project.coordinateSystem == COORDINATE_SYSTEM_LNGLAT) {
return vec4(
project_globe_(position_world.xyz),
position_world.w
);
}
if (project.coordinateSystem == COORDINATE_SYSTEM_METER_OFFSETS) {
mat3 enuMatrix = project_get_orientation_matrix(project.commonOrigin);
float metersToCommon = GLOBE_RADIUS / EARTH_RADIUS;
vec3 offsetCommon = (enuMatrix * vec3(-position_world.xy, position_world.z)) * metersToCommon;
return vec4(project.commonOrigin + offsetCommon, position_world.w);
}
}
if (project.projectionMode == PROJECTION_MODE_WEB_MERCATOR_AUTO_OFFSET) {
if (project.coordinateSystem == COORDINATE_SYSTEM_LNGLAT) {
if (abs(position_world.y - project.coordinateOrigin.y) > 0.25) {
return vec4(
project_mercator_(position_world.xy) - project.commonOrigin.xy,
project_size(position_world.z),
position_world.w
);
}
}
}
if (project.projectionMode == PROJECTION_MODE_IDENTITY ||
(project.projectionMode == PROJECTION_MODE_WEB_MERCATOR_AUTO_OFFSET &&
(project.coordinateSystem == COORDINATE_SYSTEM_LNGLAT ||
project.coordinateSystem == COORDINATE_SYSTEM_CARTESIAN))) {
position_world.xyz -= project.coordinateOrigin;
}
return project_offset_(position_world) + project_offset_(project.modelMatrix * vec4(position64Low, 0.0));
}
vec4 project_position(vec4 position) {
return project_position(position, ZERO_64_LOW);
}
vec3 project_position(vec3 position, vec3 position64Low) {
vec4 projected_position = project_position(vec4(position, 1.0), position64Low);
return projected_position.xyz;
}
vec3 project_position(vec3 position) {
vec4 projected_position = project_position(vec4(position, 1.0), ZERO_64_LOW);
return projected_position.xyz;
}
vec2 project_position(vec2 position) {
vec4 projected_position = project_position(vec4(position, 0.0, 1.0), ZERO_64_LOW);
return projected_position.xy;
}
vec4 project_common_position_to_clipspace(vec4 position, mat4 viewProjectionMatrix, vec4 center) {
return viewProjectionMatrix * position + center;
}
vec4 project_common_position_to_clipspace(vec4 position) {
return project_common_position_to_clipspace(position, project.viewProjectionMatrix, project.center);
}
vec2 project_pixel_size_to_clipspace(vec2 pixels) {
vec2 offset = pixels / project.viewportSize * project.devicePixelRatio * 2.0;
return offset * project.focalDistance;
}
float project_size_to_pixel(float meters) {
return project_size(meters) * project.scale;
}
vec2 project_size_to_pixel(vec2 meters) {
return project_size(meters) * project.scale;
}
float project_size_to_pixel(float size, int unit) {
if (unit == UNIT_METERS) return project_size_to_pixel(size);
if (unit == UNIT_COMMON) return size * project.scale;
return size;
}
float project_pixel_size(float pixels) {
return pixels / project.scale;
}
vec2 project_pixel_size(vec2 pixels) {
return pixels / project.scale;
}
`,nE={};function sE(i=nE){return"viewport"in i?j3(i):{}}const io={name:"project",dependencies:[q2,Rp],source:K3,vs:iE,getUniforms:sE,uniformTypes:{wrapLongitude:"f32",coordinateSystem:"i32",commonUnitsPerMeter:"vec3<f32>",projectionMode:"i32",scale:"f32",commonUnitsPerWorldUnit:"vec3<f32>",commonUnitsPerWorldUnit2:"vec3<f32>",center:"vec4<f32>",modelMatrix:"mat4x4<f32>",viewProjectionMatrix:"mat4x4<f32>",viewportSize:"vec2<f32>",devicePixelRatio:"f32",focalDistance:"f32",cameraPosition:"vec3<f32>",coordinateOrigin:"vec3<f32>",commonOrigin:"vec3<f32>",pseudoMeters:"f32"}},rE=`// Define a structure to hold both the clip-space position and the common position.
struct ProjectResult {
  clipPosition: vec4<f32>,
  commonPosition: vec4<f32>,
};

// This function mimics the GLSL version with the 'out' parameter by returning both values.
fn project_position_to_clipspace_and_commonspace(
    position: vec3<f32>,
    position64Low: vec3<f32>,
    offset: vec3<f32>
) -> ProjectResult {
  // Compute the projected position.
  let projectedPosition: vec3<f32> = project_position_vec3_f64(position, position64Low);

  // Start with the provided offset.
  var finalOffset: vec3<f32> = offset;

  // Get whether a rotation is needed and the rotation matrix.
  let rotationResult = project_needs_rotation(projectedPosition);

  // If rotation is needed, update the offset.
  if (rotationResult.needsRotation) {
    finalOffset = rotationResult.transform * offset;
  }

  // Compute the common position.
  let commonPosition: vec4<f32> = vec4<f32>(projectedPosition + finalOffset, 1.0);

  // Convert to clip-space.
  let clipPosition: vec4<f32> = project_common_position_to_clipspace(commonPosition);

  return ProjectResult(clipPosition, commonPosition);
}

// A convenience overload that returns only the clip-space position.
fn project_position_to_clipspace(
    position: vec3<f32>,
    position64Low: vec3<f32>,
    offset: vec3<f32>
) -> vec4<f32> {
  return project_position_to_clipspace_and_commonspace(position, position64Low, offset).clipPosition;
}
`,oE=`vec4 project_position_to_clipspace(
  vec3 position, vec3 position64Low, vec3 offset, out vec4 commonPosition
) {
  vec3 projectedPosition = project_position(position, position64Low);
  mat3 rotation;
  if (project_needs_rotation(projectedPosition, rotation)) {
    // offset is specified as ENU
    // when in globe projection, rotate offset so that the ground alighs with the surface of the globe
    offset = rotation * offset;
  }
  commonPosition = vec4(projectedPosition + offset, 1.0);
  return project_common_position_to_clipspace(commonPosition);
}

vec4 project_position_to_clipspace(
  vec3 position, vec3 position64Low, vec3 offset
) {
  vec4 commonPosition;
  return project_position_to_clipspace(position, position64Low, offset, commonPosition);
}
`,bi={name:"project32",dependencies:[io],source:rE,vs:oE};function aE(){return[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]}function Ui(i,e){const t=rn([],e,i);return Tl(t,t,1/t[3]),t}function cE(i,e,t){return t*e+(1-t)*i}function pc(i,e,t){return i<e?e:i>t?t:i}function lE(i){return Math.log(i)*Math.LOG2E}const Np=Math.log2||lE;function Et(i,e){if(!i)throw new Error(e||"@math.gl/web-mercator: assertion failed.")}const Xe=Math.PI,Up=Xe/4,je=Xe/180,mc=180/Xe,qi=512,Lr=4003e4,Ye=85.051129,uE=1.5;function Wf(i){return Math.pow(2,i)}function $p(i){return Np(i)}function bt(i){const[e,t]=i;Et(Number.isFinite(e)),Et(Number.isFinite(t)&&t>=-90&&t<=90,"invalid latitude");const n=e*je,s=t*je,r=qi*(n+Xe)/(2*Xe),o=qi*(Xe+Math.log(Math.tan(Up+s*.5)))/(2*Xe);return[r,o]}function on(i){const[e,t]=i,n=e/qi*(2*Xe)-Xe,s=2*(Math.atan(Math.exp(t/qi*(2*Xe)-Xe))-Up);return[n*mc,s*mc]}function fE(i){const{latitude:e}=i;Et(Number.isFinite(e));const t=Math.cos(e*je);return $p(Lr*t)-9}function Xo(i){const e=Math.cos(i*je);return qi/Lr/e}function yc(i){const{latitude:e,longitude:t,highPrecision:n=!1}=i;Et(Number.isFinite(e)&&Number.isFinite(t));const s=qi,r=Math.cos(e*je),o=s/360,a=o/r,c=s/Lr/r,l={unitsPerMeter:[c,c,c],metersPerUnit:[1/c,1/c,1/c],unitsPerDegree:[o,a,c],degreesPerUnit:[1/o,1/a,1/c]};if(n){const u=je*Math.tan(e*je)/r,f=o*u/2,d=s/Lr*u,h=d/a*c;l.unitsPerDegree2=[0,f,d],l.unitsPerMeter2=[h,0,h]}return l}function Gp(i,e){const[t,n,s]=i,[r,o,a]=e,{unitsPerMeter:c,unitsPerMeter2:l}=yc({longitude:t,latitude:n,highPrecision:!0}),u=bt(i);u[0]+=r*(c[0]+l[0]*o),u[1]+=o*(c[1]+l[1]*o);const f=on(u),d=(s||0)+(a||0);return Number.isFinite(s)||Number.isFinite(a)?[f[0],f[1],d]:f}function dE(i){const{height:e,pitch:t,bearing:n,altitude:s,scale:r,center:o}=i,a=aE();Sr(a,a,[0,0,-s]),xp(a,a,-t*je),wp(a,a,n*je);const c=r/e;return Ll(a,a,[c,c,c]),o&&Sr(a,a,HP([],o)),a}function hE(i){const{width:e,height:t,altitude:n,pitch:s=0,offset:r,center:o,scale:a,nearZMultiplier:c=1,farZMultiplier:l=1}=i;let{fovy:u=Yn(uE)}=i;n!==void 0&&(u=Yn(n));const f=u*je,d=s*je,h=Rl(u);let g=h;o&&(g+=o[2]*a/Math.cos(d)/t);const p=f*(.5+(r?r[1]:0)/t),m=Math.sin(p)*g/Math.sin(pc(Math.PI/2-d-p,.01,Math.PI-.01)),_=Math.sin(d)*m+g,v=g*10,b=Math.min(_*l,v);return{fov:f,aspect:e/t,focalDistance:h,near:c,far:b}}function Yn(i){return 2*Math.atan(.5/i)*mc}function Rl(i){return .5/Math.tan(.5*i*je)}function Ol(i,e){const[t,n,s=0]=i;return Et(Number.isFinite(t)&&Number.isFinite(n)&&Number.isFinite(s)),Ui(e,[t,n,s,1])}function kl(i,e,t=0){const[n,s,r]=i;if(Et(Number.isFinite(n)&&Number.isFinite(s),"invalid pixel coordinate"),Number.isFinite(r))return Ui(e,[n,s,r,1]);const o=Ui(e,[n,s,0,1]),a=Ui(e,[n,s,1,1]),c=o[2],l=a[2],u=c===l?0:((t||0)-c)/(l-c);return mp([],o,a,u)}function gE(i){const{width:e,height:t,bounds:n,minExtent:s=0,maxZoom:r=24,offset:o=[0,0]}=i,[[a,c],[l,u]]=n,f=pE(i.padding),d=bt([a,pc(u,-Ye,Ye)]),h=bt([l,pc(c,-Ye,Ye)]),g=[Math.max(Math.abs(h[0]-d[0]),s),Math.max(Math.abs(h[1]-d[1]),s)],p=[e-f.left-f.right-Math.abs(o[0])*2,t-f.top-f.bottom-Math.abs(o[1])*2];Et(p[0]>0&&p[1]>0);const m=p[0]/g[0],_=p[1]/g[1],v=(f.right-f.left)/2/m,b=(f.top-f.bottom)/2/_,x=[(h[0]+d[0])/2+v,(h[1]+d[1])/2+b],w=on(x),C=Math.min(r,Np(Math.abs(Math.min(m,_))));return Et(Number.isFinite(C)),{longitude:w[0],latitude:w[1],zoom:C}}function pE(i=0){return typeof i=="number"?{top:i,bottom:i,left:i,right:i}:(Et(Number.isFinite(i.top)&&Number.isFinite(i.bottom)&&Number.isFinite(i.left)&&Number.isFinite(i.right)),i)}const Hf=Math.PI/180;function mE(i,e=0){const{width:t,height:n,unproject:s}=i,r={targetZ:e},o=s([0,n],r),a=s([t,n],r);let c,l;const u=i.fovy?.5*i.fovy*Hf:Math.atan(.5/i.altitude),f=(90-i.pitch)*Hf;return u>f-.01?(c=Yf(i,0,e),l=Yf(i,t,e)):(c=s([0,0],r),l=s([t,0],r)),[o,a,l,c]}function Yf(i,e,t){const{pixelUnprojectionMatrix:n}=i,s=Ui(n,[e,0,1,1]),r=Ui(n,[e,i.height,1,1]),a=(t*i.distanceScales.unitsPerMeter[2]-s[2])/(r[2]-s[2]),c=mp([],s,r,a),l=on(c);return l.push(t),l}const Vp=.01,yE=["longitude","latitude","zoom"],jp={curve:1.414,speed:1.2};function _E(i,e,t,n){const{startZoom:s,startCenterXY:r,uDelta:o,w0:a,u1:c,S:l,rho:u,rho2:f,r0:d}=Wp(i,e,n);if(c<Vp){const x={};for(const w of yE){const C=i[w],B=e[w];x[w]=cE(C,B,t)}return x}const h=t*l,g=Math.cosh(d)/Math.cosh(d+u*h),p=a*((Math.cosh(d)*Math.tanh(d+u*h)-Math.sinh(d))/f)/c,m=1/g,_=s+$p(m),v=BP([],o,p);oc(v,v,r);const b=on(v);return{longitude:b[0],latitude:b[1],zoom:_}}function bE(i,e,t){const n={...jp,...t},{screenSpeed:s,speed:r,maxDuration:o}=n,{S:a,rho:c}=Wp(i,e,n),l=1e3*a;let u;return Number.isFinite(s)?u=l/(s/c):u=l/r,Number.isFinite(o)&&u>o?0:u}function Wp(i,e,t){t=Object.assign({},jp,t);const n=t.curve,s=i.zoom,r=[i.longitude,i.latitude],o=Wf(s),a=e.zoom,c=[e.longitude,e.latitude],l=Wf(a-s),u=bt(r),f=bt(c),d=yp([],f,u),h=Math.max(i.width,i.height),g=h/l,p=DP(d)*o,m=Math.max(p,Vp),_=n*n,v=(g*g-h*h+_*_*m*m)/(2*h*_*m),b=(g*g-h*h-_*_*m*m)/(2*g*_*m),x=Math.log(Math.sqrt(v*v+1)-v),w=Math.log(Math.sqrt(b*b+1)-b),C=(w-x)/n;return{startZoom:s,startCenterXY:u,uDelta:d,w0:h,u1:p,S:C,rho:n,rho2:_,r0:x,r1:w}}const Hp=`
layout(std140) uniform shadowUniforms {
  bool drawShadowMap;
  bool useShadowMap;
  vec4 color;
  highp int lightId;
  float lightCount;
  mat4 viewProjectionMatrix0;
  mat4 viewProjectionMatrix1;
  vec4 projectCenter0;
  vec4 projectCenter1;
} shadow;
`,vE=`
const int max_lights = 2;

out vec3 shadow_vPosition[max_lights];

vec4 shadow_setVertexPosition(vec4 position_commonspace) {
  mat4 viewProjectionMatrices[max_lights];
  viewProjectionMatrices[0] = shadow.viewProjectionMatrix0;
  viewProjectionMatrices[1] = shadow.viewProjectionMatrix1;
  vec4 projectCenters[max_lights];
  projectCenters[0] = shadow.projectCenter0;
  projectCenters[1] = shadow.projectCenter1;

  if (shadow.drawShadowMap) {
    return project_common_position_to_clipspace(position_commonspace, viewProjectionMatrices[shadow.lightId], projectCenters[shadow.lightId]);
  }
  if (shadow.useShadowMap) {
    for (int i = 0; i < max_lights; i++) {
      if(i < int(shadow.lightCount)) {
        vec4 shadowMap_position = project_common_position_to_clipspace(position_commonspace, viewProjectionMatrices[i], projectCenters[i]);
        shadow_vPosition[i] = (shadowMap_position.xyz / shadowMap_position.w + 1.0) / 2.0;
      }
    }
  }
  return gl_Position;
}
`,xE=`
${Hp}
${vE}
`,wE=`
const int max_lights = 2;
uniform sampler2D shadow_uShadowMap0;
uniform sampler2D shadow_uShadowMap1;

in vec3 shadow_vPosition[max_lights];

const vec4 bitPackShift = vec4(1.0, 255.0, 65025.0, 16581375.0);
const vec4 bitUnpackShift = 1.0 / bitPackShift;
const vec4 bitMask = vec4(1.0 / 255.0, 1.0 / 255.0, 1.0 / 255.0,  0.0);

float shadow_getShadowWeight(vec3 position, sampler2D shadowMap) {
  vec4 rgbaDepth = texture(shadowMap, position.xy);

  float z = dot(rgbaDepth, bitUnpackShift);
  return smoothstep(0.001, 0.01, position.z - z);
}

vec4 shadow_filterShadowColor(vec4 color) {
  if (shadow.drawShadowMap) {
    vec4 rgbaDepth = fract(gl_FragCoord.z * bitPackShift);
    rgbaDepth -= rgbaDepth.gbaa * bitMask;
    return rgbaDepth;
  }
  if (shadow.useShadowMap) {
    float shadowAlpha = 0.0;
    shadowAlpha += shadow_getShadowWeight(shadow_vPosition[0], shadow_uShadowMap0);
    if(shadow.lightCount > 1.0) {
      shadowAlpha += shadow_getShadowWeight(shadow_vPosition[1], shadow_uShadowMap1);
    }
    shadowAlpha *= shadow.color.a / shadow.lightCount;
    float blendedAlpha = shadowAlpha + color.a * (1.0 - shadowAlpha);

    return vec4(
      mix(color.rgb, shadow.color.rgb, shadowAlpha / blendedAlpha),
      blendedAlpha
    );
  }
  return color;
}
`,PE=`
${Hp}
${wE}
`,SE=ss(AE),EE=ss(ME),CE=[0,0,0,1],LE=[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,0];function TE(i,e){const[t,n,s]=i,r=kl([t,n,s],e);return Number.isFinite(s)?r:[r[0],r[1],0]}function AE({viewport:i,center:e}){return new Je(i.viewProjectionMatrix).invert().transform(e)}function ME({viewport:i,shadowMatrices:e}){const t=[],n=i.pixelUnprojectionMatrix,s=i.isGeospatial?void 0:1,r=[[0,0,s],[i.width,0,s],[0,i.height,s],[i.width,i.height,s],[0,0,-1],[i.width,0,-1],[0,i.height,-1],[i.width,i.height,-1]].map(o=>TE(o,n));for(const o of e){const a=o.clone().translate(new yt(i.center).negate()),c=r.map(u=>a.transform(u)),l=new Je().ortho({left:Math.min(...c.map(u=>u[0])),right:Math.max(...c.map(u=>u[0])),bottom:Math.min(...c.map(u=>u[1])),top:Math.max(...c.map(u=>u[1])),near:Math.min(...c.map(u=>-u[2])),far:Math.max(...c.map(u=>-u[2]))});t.push(l.multiplyRight(o))}return t}function IE(i){const{shadowEnabled:e=!0,project:t}=i;if(!e||!t||!i.shadowMatrices||!i.shadowMatrices.length)return{drawShadowMap:!1,useShadowMap:!1,shadow_uShadowMap0:i.dummyShadowMap,shadow_uShadowMap1:i.dummyShadowMap};const n=io.getUniforms(t),s=SE({viewport:t.viewport,center:n.center}),r=[],o=EE({shadowMatrices:i.shadowMatrices,viewport:t.viewport}).slice();for(let c=0;c<i.shadowMatrices.length;c++){const l=o[c],u=l.clone().translate(new yt(t.viewport.center).negate());n.coordinateSystem===to("lnglat")&&n.projectionMode===Re.WEB_MERCATOR?(o[c]=u,r[c]=s):(o[c]=l.clone().multiplyRight(LE),r[c]=u.transform(s))}const a={drawShadowMap:!!i.drawToShadowMap,useShadowMap:i.shadowMaps?i.shadowMaps.length>0:!1,color:i.shadowColor||CE,lightId:i.shadowLightId||0,lightCount:i.shadowMatrices.length,shadow_uShadowMap0:i.dummyShadowMap,shadow_uShadowMap1:i.dummyShadowMap};for(let c=0;c<o.length;c++)a[`viewProjectionMatrix${c}`]=o[c],a[`projectCenter${c}`]=r[c];for(let c=0;c<2;c++)a[`shadow_uShadowMap${c}`]=i.shadowMaps&&i.shadowMaps[c]||i.dummyShadowMap;return a}const qf={name:"shadow",dependencies:[io],vs:xE,fs:PE,inject:{"vs:DECKGL_FILTER_GL_POSITION":`
    position = shadow_setVertexPosition(geometry.position);
    `,"fs:DECKGL_FILTER_COLOR":`
    color = shadow_filterShadowColor(color);
    `},getUniforms:IE,uniformTypes:{drawShadowMap:"f32",useShadowMap:"f32",color:"vec4<f32>",lightId:"i32",lightCount:"f32",viewProjectionMatrix0:"mat4x4<f32>",viewProjectionMatrix1:"mat4x4<f32>",projectCenter0:"vec4<f32>",projectCenter1:"vec4<f32>"}},Tr=10,Ar=16777215;function RE(i,e){i.length===Tr?K.warn(`pickMultipleObjects can only exclude ${Tr} previously picked objects for layers without picking buffers`)():i.push(e)}const OE=`  float disabledPickingIndexCount;
  vec4 disabledPickingIndices0;
  vec4 disabledPickingIndices1;
  vec4 disabledPickingIndices2;
`;function Zf(i){return i.replace(`  vec4 highlightColor;
} picking;`,`  vec4 highlightColor;
${OE}} picking;`)}function Ko(i,e){return[i[e]||0,i[e+1]||0,i[e+2]||0,i[e+3]||0]}const kE=`vec3 picking_getPickingColorFromIndex(float objectIndex) {
  if (objectIndex < 0.0 || objectIndex >= ${Ar}.0) {
    return vec3(0.0);
  }

  for (int i = 0; i < ${Tr}; i++) {
    if (float(i) >= picking.disabledPickingIndexCount) {
      break;
    }
    vec4 disabledIndices = i < 4
      ? picking.disabledPickingIndices0
      : (i < 8 ? picking.disabledPickingIndices1 : picking.disabledPickingIndices2);
    float disabledIndex = disabledIndices[i - (i / 4) * 4];
    if (disabledIndex == objectIndex) {
      return vec3(0.0);
    }
  }

  float encodedIndex = objectIndex + 1.0;
  return vec3(
    mod(encodedIndex, 256.0),
    mod(floor(encodedIndex / 256.0), 256.0),
    mod(floor(encodedIndex / 65536.0), 256.0)
  );
}

vec3 picking_getPickingColorFromIndex(uint objectIndex) {
  return picking_getPickingColorFromIndex(float(objectIndex));
}

vec3 picking_getPickingColorFromInstanceID() {
  return picking_getPickingColorFromIndex(float(gl_InstanceID));
}

void picking_setPickingColorFromInstanceID() {
  picking_setPickingColor(picking_getPickingColorFromInstanceID());
}
`,BE=`struct pickingUniforms {
  isActive: f32,
  isAttribute: f32,
  isHighlightActive: f32,
  useByteColors: f32,
  highlightedObjectColor: vec3<f32>,
  highlightColor: vec4<f32>,
  disabledPickingIndexCount: f32,
  disabledPickingIndices0: vec4<f32>,
  disabledPickingIndices1: vec4<f32>,
  disabledPickingIndices2: vec4<f32>,
};

@group(0) @binding(auto) var<uniform> picking: pickingUniforms;

fn picking_normalizeColor(color: vec3<f32>) -> vec3<f32> {
  return select(color, color / 255.0, picking.useByteColors > 0.5);
}

fn picking_normalizeColor4(color: vec4<f32>) -> vec4<f32> {
  return select(color, color / 255.0, picking.useByteColors > 0.5);
}

fn picking_isColorZero(color: vec3<f32>) -> bool {
  return dot(color, vec3<f32>(1.0)) < 0.00001;
}

fn picking_isColorValid(color: vec3<f32>) -> bool {
  return dot(color, vec3<f32>(1.0)) > 0.00001;
}

fn picking_getPickingColorFromIndex(objectIndex: u32) -> vec3<f32> {
  if (objectIndex >= ${Ar}u) {
    return vec3<f32>(0.0);
  }

  for (var i = 0; i < ${Tr}; i = i + 1) {
    if (f32(i) >= picking.disabledPickingIndexCount) {
      break;
    }
    let disabledIndices = select(
      picking.disabledPickingIndices2,
      select(picking.disabledPickingIndices1, picking.disabledPickingIndices0, i < 4),
      i < 8
    );
    let disabledIndex = disabledIndices[i % 4];
    if (disabledIndex == f32(objectIndex)) {
      return vec3<f32>(0.0);
    }
  }

  let encodedIndex = objectIndex + 1u;
  return vec3<f32>(
    f32(encodedIndex % 256u),
    f32((encodedIndex / 256u) % 256u),
    f32((encodedIndex / 65536u) % 256u)
  ) / 255.0;
}
`,vi={...Si,vs:`${Zf(Si.vs)}
${kE}`,fs:Zf(Si.fs),source:BE,uniformTypes:{...Si.uniformTypes,disabledPickingIndexCount:"f32",disabledPickingIndices0:"vec4<f32>",disabledPickingIndices1:"vec4<f32>",disabledPickingIndices2:"vec4<f32>"},defaultUniforms:{...Si.defaultUniforms,useByteColors:!0,disabledPickingIndexCount:0,disabledPickingIndices0:[0,0,0,0],disabledPickingIndices1:[0,0,0,0],disabledPickingIndices2:[0,0,0,0]},getUniforms(i,e){const t=Si.getUniforms(i,e),n=i.disabledPickingIndices||[];return t.disabledPickingIndexCount=n.length,t.disabledPickingIndices0=Ko(n,0),t.disabledPickingIndices1=Ko(n,4),t.disabledPickingIndices2=Ko(n,8),t},inject:{"vs:DECKGL_FILTER_GL_POSITION":`
    // for picking depth values
    picking_setPickingAttribute(position.z / position.w);
  `,"vs:DECKGL_FILTER_COLOR":`
  picking_setPickingColor(geometry.pickingColor);
  `,"fs:DECKGL_FILTER_COLOR":{order:99,injection:`
  // use highlight color if this fragment belongs to the selected object.
  color = picking_filterHighlightColor(color);

  // use picking color if rendering to picking FBO.
  color = picking_filterPickingColor(color);
    `}}},DE=[Rp],FE=["vs:DECKGL_FILTER_SIZE(inout vec3 size, VertexGeometry geometry)","vs:DECKGL_FILTER_GL_POSITION(inout vec4 position, VertexGeometry geometry)","vs:DECKGL_FILTER_COLOR(inout vec4 color, VertexGeometry geometry)","fs:DECKGL_FILTER_COLOR(inout vec4 color, FragmentGeometry geometry)"],zE=[];function NE(i){const e=Fe.getDefaultShaderAssembler(i);for(const n of DE)e.addDefaultModule(n);e._hookFunctions.length=0;const t=i==="glsl"?FE:zE;for(const n of t)e.addShaderHook(n);return e}const UE=[255,255,255],$E=1;let GE=0;class VE{constructor(e={}){this.type="ambient";const{color:t=UE}=e,{intensity:n=$E}=e;this.id=e.id||`ambient-${GE++}`,this.color=t,this.intensity=n}}const jE=[255,255,255],WE=1,HE=[0,0,-1];let YE=0;class Xf{constructor(e={}){this.type="directional";const{color:t=jE}=e,{intensity:n=WE}=e,{direction:s=HE}=e,{_shadow:r=!1}=e;this.id=e.id||`directional-${YE++}`,this.color=t,this.intensity=n,this.type="directional",this.direction=new yt(s).normalize().toArray(),this.shadow=r}getProjectedLight(e){return this}}class qE{constructor(e,t={id:"pass"}){const{id:n}=t;this.id=n,this.device=e,this.props={...t}}setProps(e){Object.assign(this.props,e)}render(e){}cleanup(){}}const ZE={depthWriteEnabled:!0,depthCompare:"less-equal",blendColorOperation:"add",blendColorSrcFactor:"one",blendColorDstFactor:"one-minus-src-alpha",blendAlphaOperation:"add",blendAlphaSrcFactor:"one",blendAlphaDstFactor:"one-minus-src-alpha"};class Bl extends qE{constructor(){super(...arguments),this._lastRenderIndex=-1}render(e){this._render(e)}_render(e){const{canvasContext:t=this.device.canvasContext}=e,n=e.target??t.getCurrentFramebuffer(),[s,r]=t.getDrawingBufferSize(),o=e.clearCanvas??!0;let a=e.clearColor??(o?[0,0,0,0]:!1),c=o?1:!1,l=o?0:!1;const u=e.colorMask??15,f={viewport:[0,0,s,r]};e.colorMask&&(f.colorMask=u),e.scissorRect&&(f.scissorRect=e.scissorRect);const{shaderModuleProps:d,viewports:h,views:g,onViewportActive:p,clearStack:m=!0}=e,_=e.pass||"unknown",v=this.device.type==="webgpu";m&&(this._lastRenderIndex=-1);const b=[];if(!h.length)return this.device.beginRenderPass({framebuffer:n,parameters:f,clearColor:a,clearDepth:c,clearStencil:l}).end(),this.device.submit(),b;try{for(const x of h){p?.(x);const w=this._getDrawLayerParams(x,e),C=g&&g[x.id],B=x.subViewports||[x],F=v?B.map(D=>[D]):[B];for(const D of F){const k=this.device.beginRenderPass({framebuffer:n,parameters:f,clearColor:a,clearDepth:c,clearStencil:l});try{for(const W of D){const G=this._drawLayersInViewport(k,{target:n,canvasContext:t,shaderModuleProps:d,viewport:W,view:C,pass:_,layers:e.layers,isPicking:e.isPicking},w);b.push(G)}}finally{k.end(),v&&this.device.submit()}a=!1,c=!1,l=!1}}return b}finally{v||this.device.submit()}}_getDrawLayerParams(e,{layers:t,pass:n,isPicking:s=!1,layerFilter:r,cullRect:o,views:a,effects:c,canvasContext:l=this.device.canvasContext,shaderModuleProps:u},f=!1){const d=[],h=Yp(this._lastRenderIndex+1),g={layer:t[0],viewport:e,isPicking:s,renderPass:n,cullRect:o},p={};for(let m=0;m<t.length;m++){const _=t[m],v=this._shouldDrawLayer(_,g,r,p),b={shouldDrawLayer:v};if(v&&!f){b.shouldDrawLayer=!0,b.layerRenderIndex=h(_,v),b.shaderModuleProps=this._getShaderModuleProps(_,c,n,l,u);const x=_.context.device.type==="webgpu"?ZE:null;b.layerParameters={...x,..._.context.deck?.props.parameters,...a?.[e.id]?.props.parameters,...this.getLayerParameters(_,m,e)}}d[m]=b}return d}_drawLayersInViewport(e,{layers:t,shaderModuleProps:n,pass:s,target:r,canvasContext:o,viewport:a,view:c,isPicking:l},u){const f=XE(this.device,{canvasContext:o,shaderModuleProps:n,target:r,viewport:a});if(c){const{clear:h,clearColor:g,clearDepth:p,clearStencil:m}=c.props;if(h){let _=[0,0,0,0],v=1,b=0;Array.isArray(g)&&!l?_=[...g.slice(0,3),g[3]||255].map(w=>w/255):g===!1&&(_=!1),p!==void 0&&(v=p),m!==void 0&&(b=m),this.device.beginRenderPass({framebuffer:r,parameters:{viewport:f,scissorRect:f},clearColor:_,clearDepth:v,clearStencil:b}).end()}}const d={totalCount:t.length,visibleCount:0,compositeCount:0,pickableCount:0};e.setParameters({viewport:f});for(let h=0;h<t.length;h++){const g=t[h],p=u[h],{shouldDrawLayer:m}=p;if(m&&g.props.pickable&&d.pickableCount++,g.isComposite&&d.compositeCount++,g.isDrawable&&p.shouldDrawLayer){const{layerRenderIndex:_,shaderModuleProps:v,layerParameters:b}=p;d.visibleCount++,this._lastRenderIndex=Math.max(this._lastRenderIndex,_),v.project&&(v.project.viewport=a),g.context.renderPass=e;try{g._drawLayer({renderPass:e,shaderModuleProps:v,uniforms:{layerIndex:_},parameters:b})}catch(x){g.raiseError(x,`drawing ${g} to ${s}`)}}}return d}shouldDrawLayer(e){return!0}getShaderModuleProps(e,t,n){return null}getLayerParameters(e,t,n){return e.props.parameters}_shouldDrawLayer(e,t,n,s){if(!(e.props.visible&&this.shouldDrawLayer(e)))return!1;t.layer=e;let o=e.parent;for(;o;){if(!o.props.visible||!o.filterSubLayer(t))return!1;t.layer=o,o=o.parent}if(n){const a=t.layer.id;if(a in s||(s[a]=n(t)),!s[a])return!1}return e.activateViewport(t.viewport),!0}_getShaderModuleProps(e,t,n,s,r){const o=s.cssToDeviceRatio(),a=e.internalState?.propsInTransition||e.props,c={layer:a,picking:{isActive:!1},project:{viewport:e.context.viewport,devicePixelRatio:o,modelMatrix:a.modelMatrix,coordinateSystem:a.coordinateSystem,coordinateOrigin:a.coordinateOrigin,autoWrapLongitude:e.wrapLongitude}};if(t)for(const l of t)Kf(c,l.getShaderModuleProps?.(e,c));for(const l of e.context.defaultShaderModules)l.name in c||(c[l.name]={});return Kf(c,this.getShaderModuleProps(e,t,c),r)}}function Yp(i=0,e={}){const t={},n=(s,r)=>{const o=s.props._offset,a=s.id,c=s.parent&&s.parent.id;let l;if(c&&!(c in e)&&n(s.parent,!1),c in t){const u=t[c]=t[c]||Yp(e[c],e);l=u(s,r),t[a]=u}else Number.isFinite(o)?(l=o+(e[c]||0),t[a]=null):l=i;return r&&l>=i&&(i=l+1),e[a]=l,l};return n}function XE(i,{canvasContext:e=i.canvasContext,shaderModuleProps:t,target:n,viewport:s}){const r=t?.project?.devicePixelRatio??e.cssToDeviceRatio(),[,o]=e.getDrawingBufferSize(),a=n?n.height:o,c=s;return[c.x*r,a-(c.y+c.height)*r,c.width*r,c.height*r]}function Kf(i,...e){for(const t of e)if(t)for(const n in t)i[n]?Object.assign(i[n],t[n]):i[n]=t[n];return i}class KE extends Bl{constructor(e,t){super(e,t);const n=e.createTexture({format:"rgba8unorm",width:1,height:1,sampler:{minFilter:"linear",magFilter:"linear",addressModeU:"clamp-to-edge",addressModeV:"clamp-to-edge"}}),s=e.createTexture({format:"depth16unorm",width:1,height:1});this.fbo=e.createFramebuffer({id:"shadowmap",width:1,height:1,colorAttachments:[n],depthStencilAttachment:s})}delete(){this.fbo&&(this.fbo.destroy(),this.fbo=null)}getShadowMap(){return this.fbo.colorAttachments[0].texture}render(e){const t=this.fbo,n=this.device.canvasContext.cssToDeviceRatio(),s=e.viewports[0],r=s.width*n,o=s.height*n,a=[1,1,1,1];(r!==t.width||o!==t.height)&&t.resize({width:r,height:o}),super.render({...e,clearColor:a,target:t,pass:"shadow"})}getLayerParameters(e,t,n){return{...e.props.parameters,blend:!1,depthWriteEnabled:!0,depthCompare:"less-equal"}}shouldDrawLayer(e){return e.props.shadowEnabled!==!1}getShaderModuleProps(e,t,n){return{shadow:{project:n.project,drawToShadowMap:!0}}}}const QE={color:[255,255,255],intensity:1},Qf=[{color:[255,255,255],intensity:1,direction:[-1,3,-1]},{color:[255,255,255],intensity:.9,direction:[1,-8,-2.5]}],JE=[0,0,0,200/255];class qp{constructor(e={}){this.id="lighting-effect",this.shadowColor=JE,this.shadow=!1,this.directionalLights=[],this.pointLights=[],this.shadowPasses=[],this.dummyShadowMap=null,this.setProps(e)}setup(e){this.context=e;const{device:t,deck:n}=e;this.shadow&&!this.dummyShadowMap&&(this._createShadowPasses(t),n._addDefaultShaderModule(qf),this.dummyShadowMap=t.createTexture({width:1,height:1}))}setProps(e){this.ambientLight=void 0,this.directionalLights=[],this.pointLights=[];for(const t in e){const n=e[t];switch(n.type){case"ambient":this.ambientLight=n;break;case"directional":this.directionalLights.push(n);break;case"point":this.pointLights.push(n);break}}this._applyDefaultLights(),this.shadow=this.directionalLights.some(t=>t.shadow),this.context&&this.setup(this.context),this.props=e}preRender({layers:e,layerFilter:t,viewports:n,onViewportActive:s,views:r}){if(this.shadow){this.shadowMatrices=this._calculateMatrices();for(let o=0;o<this.shadowPasses.length;o++)this.shadowPasses[o].render({layers:e,layerFilter:t,viewports:n,onViewportActive:s,views:r,shaderModuleProps:{shadow:{shadowLightId:o,dummyShadowMap:this.dummyShadowMap,shadowMatrices:this.shadowMatrices}}})}}getShaderModuleProps(e,t){const n=this.shadow?{project:t.project,shadowMaps:this.shadowPasses.map(o=>o.getShadowMap()),dummyShadowMap:this.dummyShadowMap,shadowColor:this.shadowColor,shadowMatrices:this.shadowMatrices}:{},s={enabled:!0,lights:this._getLights(e)},r=e.props.material;return{shadow:n,lighting:s,phongMaterial:r,gouraudMaterial:r}}cleanup(e){for(const t of this.shadowPasses)t.delete();this.shadowPasses.length=0,this.dummyShadowMap&&(this.dummyShadowMap.destroy(),this.dummyShadowMap=null,e.deck._removeDefaultShaderModule(qf))}_calculateMatrices(){const e=[];for(const t of this.directionalLights){const n=new Je().lookAt({eye:new yt(t.direction).negate()});e.push(n)}return e}_createShadowPasses(e){for(let t=0;t<this.directionalLights.length;t++){const n=new KE(e);this.shadowPasses[t]=n}}_applyDefaultLights(){const{ambientLight:e,pointLights:t,directionalLights:n}=this;!e&&t.length===0&&n.length===0&&(this.ambientLight=new VE(QE),this.directionalLights.push(new Xf(Qf[0]),new Xf(Qf[1])))}_getLights(e){const t=[];this.ambientLight&&t.push(this.ambientLight);for(const n of this.pointLights)t.push(n.getProjectedLight({layer:e}));for(const n of this.directionalLights)t.push(n.getProjectedLight({layer:e}));return t}}class eC{constructor(e={}){this._pool=[],this.opts={overAlloc:2,poolSize:100},this.setOptions(e)}setOptions(e){Object.assign(this.opts,e)}allocate(e,t,{size:n=1,type:s,padding:r=0,copy:o=!1,initialize:a=!1,maxCount:c}){const l=s||e&&e.constructor||Float32Array,u=t*n+r;if(ArrayBuffer.isView(e)){if(u<=e.length)return e;if(u*e.BYTES_PER_ELEMENT<=e.buffer.byteLength)return new l(e.buffer,0,u)}let f=1/0;c&&(f=c*n+r);const d=this._allocate(l,u,a,f);return e&&o?d.set(e):a||d.fill(0,0,4),this._release(e),d}release(e){this._release(e)}_allocate(e,t,n,s){let r=Math.max(Math.ceil(t*this.opts.overAlloc),1);r>s&&(r=s);const o=this._pool,a=e.BYTES_PER_ELEMENT*r,c=o.findIndex(l=>l.byteLength>=a);if(c>=0){const l=new e(o.splice(c,1)[0],0,r);return n&&l.fill(0),l}return new e(r)}_release(e){if(!ArrayBuffer.isView(e))return;const t=this._pool,{buffer:n}=e,{byteLength:s}=n,r=t.findIndex(o=>o.byteLength>=s);r<0?t.push(n):(r>0||t.length<this.opts.poolSize)&&t.splice(r,0,n),t.length>this.opts.poolSize&&t.shift()}}const Zi=new eC;function En(){return[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]}function Xi(i,e){const t=i%e;return t<0?e+t:t}function tC(i){return[i[12],i[13],i[14]]}function iC(i){return{left:Ei(i[3]+i[0],i[7]+i[4],i[11]+i[8],i[15]+i[12]),right:Ei(i[3]-i[0],i[7]-i[4],i[11]-i[8],i[15]-i[12]),bottom:Ei(i[3]+i[1],i[7]+i[5],i[11]+i[9],i[15]+i[13]),top:Ei(i[3]-i[1],i[7]-i[5],i[11]-i[9],i[15]-i[13]),near:Ei(i[3]+i[2],i[7]+i[6],i[11]+i[10],i[15]+i[14]),far:Ei(i[3]-i[2],i[7]-i[6],i[11]-i[10],i[15]-i[14])}}const Jf=new yt;function Ei(i,e,t,n){Jf.set(i,e,t);const s=Jf.len();return{distance:n/s,normal:new yt(-i/s,-e/s,-t/s)}}function nC(i){return i-Math.fround(i)}let fn;function Hs(i,e){const{size:t=1,startIndex:n=0}=e,s=e.endIndex!==void 0?e.endIndex:i.length,r=(s-n)/t;fn=Zi.allocate(fn,r,{type:Float32Array,size:t*2});let o=n,a=0;for(;o<s;){for(let c=0;c<t;c++){const l=i[o++];fn[a+c]=l,fn[a+c+t]=nC(l)}a+=t*2}return fn.subarray(0,r*t*2)}function sC(i){let e=null,t=!1;for(const n of i)n&&(e?(t||(e=[[e[0][0],e[0][1]],[e[1][0],e[1][1]]],t=!0),e[0][0]=Math.min(e[0][0],n[0][0]),e[0][1]=Math.min(e[0][1],n[0][1]),e[1][0]=Math.max(e[1][0],n[1][0]),e[1][1]=Math.max(e[1][1],n[1][1])):e=n);return e}const rC=Math.PI/180,oC=En(),ed=[0,0,0],aC={unitsPerMeter:[1,1,1],metersPerUnit:[1,1,1]};function cC({width:i,height:e,orthographic:t,fovyRadians:n,focalDistance:s,padding:r,near:o,far:a}){const c=i/e,l=t?new Je().orthographic({fovy:n,aspect:c,focalDistance:s,near:o,far:a}):new Je().perspective({fovy:n,aspect:c,near:o,far:a});if(r){const{left:u=0,right:f=0,top:d=0,bottom:h=0}=r,g=me((u+i-f)/2,0,i)-i/2,p=me((d+e-h)/2,0,e)-e/2;l[8]-=g*2/i,l[9]+=p*2/e}return l}class an{constructor(e={}){this._frustumPlanes={},this.id=e.id||this.constructor.displayName||"viewport",this.x=e.x||0,this.y=e.y||0,this.width=e.width||1,this.height=e.height||1,this.zoom=e.zoom||0,this.padding=e.padding,this.distanceScales=e.distanceScales||aC,this.focalDistance=e.focalDistance||1,this.position=e.position||ed,this.modelMatrix=e.modelMatrix||null;const{longitude:t,latitude:n}=e;this.isGeospatial=Number.isFinite(n)&&Number.isFinite(t),this._initProps(e),this._initMatrices(e),this.equals=this.equals.bind(this),this.project=this.project.bind(this),this.unproject=this.unproject.bind(this),this.projectPosition=this.projectPosition.bind(this),this.unprojectPosition=this.unprojectPosition.bind(this),this.projectFlat=this.projectFlat.bind(this),this.unprojectFlat=this.unprojectFlat.bind(this)}get subViewports(){return null}get metersPerPixel(){return this.distanceScales.metersPerUnit[2]/this.scale}get projectionMode(){return this.isGeospatial?this.zoom<12?Re.WEB_MERCATOR:Re.WEB_MERCATOR_AUTO_OFFSET:Re.IDENTITY}equals(e){return e instanceof an?this===e?!0:e.width===this.width&&e.height===this.height&&e.scale===this.scale&&e.projectionMode===this.projectionMode&&e.resolution===this.resolution&&Ni(e.distanceScales.unitsPerMeter,this.distanceScales.unitsPerMeter)&&Ni(e.projectionMatrix,this.projectionMatrix)&&Ni(e.viewMatrix,this.viewMatrix):!1}project(e,{topLeft:t=!0}={}){const n=this.projectPosition(e),s=Ol(n,this.pixelProjectionMatrix),[r,o]=s,a=t?o:this.height-o;return e.length===2?[r,a]:[r,a,s[2]]}unproject(e,{topLeft:t=!0,targetZ:n}={}){const[s,r,o]=e,a=t?r:this.height-r,c=n&&n*this.distanceScales.unitsPerMeter[2],l=kl([s,a,o],this.pixelUnprojectionMatrix,c),[u,f,d]=this.unprojectPosition(l);return Number.isFinite(o)?[u,f,d]:Number.isFinite(n)?[u,f,n]:[u,f]}projectPosition(e){const[t,n]=this.projectFlat(e),s=(e[2]||0)*this.distanceScales.unitsPerMeter[2];return[t,n,s]}unprojectPosition(e){const[t,n]=this.unprojectFlat(e),s=(e[2]||0)*this.distanceScales.metersPerUnit[2];return[t,n,s]}projectFlat(e){if(this.isGeospatial){const t=bt(e);return t[1]=me(t[1],-318,830),t}return e}unprojectFlat(e){return this.isGeospatial?on(e):e}getBounds(e={}){const t={targetZ:e.z||0},n=this.unproject([0,0],t),s=this.unproject([this.width,0],t),r=this.unproject([0,this.height],t),o=this.unproject([this.width,this.height],t);return[Math.min(n[0],s[0],r[0],o[0]),Math.min(n[1],s[1],r[1],o[1]),Math.max(n[0],s[0],r[0],o[0]),Math.max(n[1],s[1],r[1],o[1])]}getDistanceScales(e){return e&&this.isGeospatial?yc({longitude:e[0],latitude:e[1],highPrecision:!0}):this.distanceScales}containsPixel({x:e,y:t,width:n=1,height:s=1}){return e<this.x+this.width&&this.x<e+n&&t<this.y+this.height&&this.y<t+s}getFrustumPlanes(){return this._frustumPlanes.near?this._frustumPlanes:(Object.assign(this._frustumPlanes,iC(this.viewProjectionMatrix)),this._frustumPlanes)}panByPosition(e,t,n){return null}_initProps(e){const t=e.longitude,n=e.latitude;this.isGeospatial&&(Number.isFinite(e.zoom)||(this.zoom=fE({latitude:n})+Math.log2(this.focalDistance)),this.distanceScales=e.distanceScales||yc({latitude:n,longitude:t}));const s=Math.pow(2,this.zoom);this.scale=s;const{position:r,modelMatrix:o}=e;let a=ed;if(r&&(a=o?new Je(o).transformAsVector(r,[]):r),this.isGeospatial){const c=this.projectPosition([t,n,0]);this.center=new yt(a).scale(this.distanceScales.unitsPerMeter).add(c)}else this.center=this.projectPosition(a)}_initMatrices(e){const{viewMatrix:t=oC,projectionMatrix:n=null,orthographic:s=!1,fovyRadians:r,fovy:o=75,near:a=.1,far:c=1e3,padding:l=null,focalDistance:u=1}=e;this.viewMatrixUncentered=t,this.viewMatrix=new Je().multiplyRight(t).translate(new yt(this.center).negate()),this.projectionMatrix=n||cC({width:this.width,height:this.height,orthographic:s,fovyRadians:r||o*rC,focalDistance:u,padding:l,near:a,far:c});const f=En();si(f,f,this.projectionMatrix),si(f,f,this.viewMatrix),this.viewProjectionMatrix=f,this.viewMatrixInverse=cc([],this.viewMatrix)||this.viewMatrix,this.cameraPosition=tC(this.viewMatrixInverse);const d=En(),h=En();Ll(d,d,[this.width/2,-this.height/2,1]),Sr(d,d,[1,-1,0]),si(h,d,this.viewProjectionMatrix),this.pixelProjectionMatrix=h,this.pixelUnprojectionMatrix=cc(En(),this.pixelProjectionMatrix),this.pixelUnprojectionMatrix||K.warn("Pixel project matrix not invertible")()}}an.displayName="Viewport";class St extends an{constructor(e={}){const{latitude:t=0,longitude:n=0,zoom:s=0,pitch:r=0,bearing:o=0,nearZMultiplier:a=.1,farZMultiplier:c=1.01,nearZ:l,farZ:u,orthographic:f=!1,projectionMatrix:d,repeat:h=!1,worldOffset:g=0,position:p,padding:m,legacyMeterSizes:_=!1}=e;let{width:v,height:b,altitude:x=1.5}=e;const w=Math.pow(2,s);v=v||1,b=b||1;let C,B=null;if(d)x=d[5]/2,C=Yn(x);else{e.fovy?(C=e.fovy,x=Rl(C)):C=Yn(x);let D;if(m){const{top:k=0,bottom:W=0}=m;D=[0,me((k+b-W)/2,0,b)-b/2]}B=hE({width:v,height:b,scale:w,center:p&&[0,0,p[2]*Xo(t)],offset:D,pitch:r,fovy:C,nearZMultiplier:a,farZMultiplier:c}),Number.isFinite(l)&&(B.near=l),Number.isFinite(u)&&(B.far=u)}let F=dE({height:b,pitch:r,bearing:o,scale:w,altitude:x});g&&(F=new Je().translate([512*g,0,0]).multiplyLeft(F)),super({...e,width:v,height:b,viewMatrix:F,longitude:n,latitude:t,zoom:s,...B,fovy:C,focalDistance:x}),this.latitude=t,this.longitude=n,this.zoom=s,this.pitch=r,this.bearing=o,this.altitude=x,this.fovy=C,this.orthographic=f,this._subViewports=h?[]:null,this._pseudoMeters=_,Object.freeze(this)}get subViewports(){if(this._subViewports&&!this._subViewports.length){const e=this.getBounds(),t=Math.floor((e[0]+180)/360),n=Math.ceil((e[2]-180)/360);for(let s=t;s<=n;s++){const r=s?new St({...this,worldOffset:s}):this;this._subViewports.push(r)}}return this._subViewports}equals(e){return e instanceof St&&e._pseudoMeters===this._pseudoMeters&&super.equals(e)}projectPosition(e){if(this._pseudoMeters)return super.projectPosition(e);const[t,n]=this.projectFlat(e),s=(e[2]||0)*Xo(e[1]);return[t,n,s]}unprojectPosition(e){if(this._pseudoMeters)return super.unprojectPosition(e);const[t,n]=this.unprojectFlat(e),s=(e[2]||0)/Xo(n);return[t,n,s]}addMetersToLngLat(e,t){return Gp(e,t)}panByPosition(e,t,n){const s=kl(t,this.pixelUnprojectionMatrix),r=this.projectFlat(e),o=oc([],r,FP([],s)),a=oc([],this.center,o),[c,l]=this.unprojectFlat(a);return{longitude:c,latitude:l}}panByPosition3D(e,t){const n=e[2]||0,s=yp([],e,this.unproject(t,{targetZ:n}));return{longitude:this.longitude+s[0],latitude:this.latitude+s[1]}}getBounds(e={}){const t=mE(this,e.z||0);return[Math.min(t[0][0],t[1][0],t[2][0],t[3][0]),Math.min(t[0][1],t[1][1],t[2][1],t[3][1]),Math.max(t[0][0],t[1][0],t[2][0],t[3][0]),Math.max(t[0][1],t[1][1],t[2][1],t[3][1])]}fitBounds(e,t={}){const{width:n,height:s}=this,{longitude:r,latitude:o,zoom:a}=gE({width:n,height:s,bounds:e,...t});return new St({width:n,height:s,longitude:r,latitude:o,zoom:a})}}St.displayName="WebMercatorViewport";const td=[0,0,0];function Qo(i,e,t=!1){const n=e.projectPosition(i);if(t&&e instanceof St){const[s,r,o=0]=i,a=e.getDistanceScales([s,r]);n[2]=o*a.unitsPerMeter[2]}return n}function lC(i){const{viewport:e,modelMatrix:t,coordinateOrigin:n}=i;let{coordinateSystem:s,fromCoordinateSystem:r,fromCoordinateOrigin:o}=i;return s==="default"&&(s=e.isGeospatial?"lnglat":"cartesian"),r===void 0?r=s:r==="default"&&(r=e.isGeospatial?"lnglat":"cartesian"),o===void 0&&(o=n),{viewport:e,coordinateSystem:s,coordinateOrigin:n,modelMatrix:t,fromCoordinateSystem:r,fromCoordinateOrigin:o}}function Dl(i,{viewport:e,modelMatrix:t,coordinateSystem:n,coordinateOrigin:s,offsetMode:r}){let[o,a,c=0]=i;switch(t&&([o,a,c]=rn([],[o,a,c,1],t)),n){case"default":return Dl(i,{viewport:e,modelMatrix:t,coordinateSystem:e.isGeospatial?"lnglat":"cartesian",coordinateOrigin:s,offsetMode:r});case"lnglat":return Qo([o,a,c],e,r);case"lnglat-offsets":return Qo([o+s[0],a+s[1],c+(s[2]||0)],e,r);case"meter-offsets":return Qo(Gp(s,[o,a,c]),e,r);case"cartesian":return e.isGeospatial?[o+s[0],a+s[1],c+s[2]]:e.projectPosition([o,a,c]);default:throw new Error(`Invalid coordinateSystem: ${n}`)}}function uC(i,e){const{viewport:t,coordinateSystem:n,coordinateOrigin:s,modelMatrix:r,fromCoordinateSystem:o,fromCoordinateOrigin:a}=lC(e),{autoOffset:c=!0}=e,{geospatialOrigin:l=td,shaderCoordinateOrigin:u=td,offsetMode:f=!1}=c?zp(t,n,s):{},d=Dl(i,{viewport:t,modelMatrix:r,coordinateSystem:o,coordinateOrigin:a,offsetMode:f});if(f){const h=t.projectPosition(l||u);vp(d,d,h)}return d}const Jo={};function rs(i="id"){Jo[i]=Jo[i]||1;const e=Jo[i]++;return`${i}-${e}`}class ui{id;topology;vertexCount;indices;attributes;bufferLayout;userData={};constructor(e){const{attributes:t={},indices:n=null,vertexCount:s=null}=e;this.id=e.id||rs("geometry"),this.topology=e.topology,n&&(this.indices=ArrayBuffer.isView(n)?{value:n,size:1}:n),this.attributes={};for(const[r,o]of Object.entries(t)){const a=ArrayBuffer.isView(o)?{value:o}:o;if(!ArrayBuffer.isView(a.value))throw new Error(`${this._print(r)}: must be typed array or object with value as typed array`);if((r==="POSITION"||r==="positions")&&!a.size&&(a.size=3),r==="indices"){if(this.indices)throw new Error("Multiple indices detected");this.indices=a}else{const c=qn(r),l=Object.keys(this.attributes).find(u=>qn(u)===c);l&&delete this.attributes[l],this.attributes[r]=a}}this.indices&&this.indices.isIndexed!==void 0&&(this.indices=Object.assign({},this.indices),delete this.indices.isIndexed),this.vertexCount=s||this._calculateVertexCount(this.attributes,this.indices),this.bufferLayout=e.bufferLayout||fC(this.attributes)}getVertexCount(){return this.vertexCount}getAttributes(){return this.indices?{indices:this.indices,...this.attributes}:this.attributes}_print(e){return`Geometry ${this.id} attribute ${e}`}_setAttributes(e,t){return this}_calculateVertexCount(e,t){if(t)return t.value.length;let n=1/0;for(const s of Object.values(e)){if(!s)continue;const{value:r,size:o,constant:a}=s;!a&&r&&o!==void 0&&o>=1&&(n=Math.min(n,r.length/o))}return n}}function qn(i){switch(i){case"POSITION":return"positions";case"NORMAL":return"normals";case"TEXCOORD_0":return"texCoords";case"TEXCOORD_1":return"texCoords1";case"COLOR_0":return"colors";default:return i}}function fC(i){const e=[];for(const[t,n]of Object.entries(i)){if(!n)continue;const{value:s,size:r,normalized:o}=n;if(r===void 0)throw new Error(`Attribute ${t} is missing a size`);e.push({name:qn(t),format:Ee.getVertexFormatFromAttribute(s,r,o)})}return e}function dC(i,e={}){const t=e.bufferName||"geometry";if(hC(i,t))return i;const n=e.minAttributeAlignment||4,s=gC(i,e.attributes),r=[];let o=0,a=1/0;for(const[u,f]of s){if(!f)continue;if(f.constant)throw new Error(`Attribute ${u} is constant`);const{value:d,size:h,normalized:g}=f;if(!ArrayBuffer.isView(d))throw new Error(`Attribute ${u} is missing typed array data`);if(h===void 0)throw new Error(`Attribute ${u} is missing a size`);const p=Ee.getVertexFormatFromAttribute(d,h,g),m=Ee.getVertexFormatInfo(p);o=id(o,n),r.push({sourceName:u,attributeName:qn(u),value:d,size:h,format:p,byteOffset:o,byteLength:m.byteLength}),o+=m.byteLength;const _=d.length/h;if(!Number.isInteger(_))throw new Error(`Attribute ${u} length is not divisible by size`);a=Math.min(a,_)}if(r.length===0||!Number.isFinite(a))throw new Error(`Geometry ${i.id} has no interleavable attributes`);const c=id(o,n),l=new ArrayBuffer(a*c);for(const u of r)pC(l,a,c,u);return new ui({id:i.id,topology:i.topology||"triangle-list",vertexCount:i.vertexCount,indices:i.indices,attributes:{[t]:{value:new Uint8Array(l),size:c,byteStride:c}},bufferLayout:[{name:t,stepMode:"vertex",byteStride:c,attributes:r.map(u=>({attribute:u.attributeName,format:u.format,byteOffset:u.byteOffset}))}]})}function hC(i,e){if(i.bufferLayout.length!==1)return!1;const t=i.bufferLayout[0];return t.name===e&&!!t.attributes?.length&&!!i.attributes[e]}function gC(i,e){return e?e.map(t=>[t,i.attributes[t]]):Object.entries(i.attributes)}function pC(i,e,t,n){const s=n.value.constructor,r=s.BYTES_PER_ELEMENT;if(n.byteOffset%r!==0||t%r!==0)throw new Error(`Attribute ${n.sourceName} is not aligned to its component type`);const o=new s(i),a=n.value,c=n.byteOffset/r,l=t/r;for(let u=0;u<e;u++){const f=u*n.size,d=u*l+c;for(let h=0;h<n.size;h++)o[d+h]=a[f+h]}}function id(i,e){return Math.ceil(i/e)*e}let mC=1,yC=1;class Zp{time=0;channels=new Map;animations=new Map;playing=!1;lastEngineTime=-1;constructor(){}addChannel(e){const{delay:t=0,duration:n=Number.POSITIVE_INFINITY,rate:s=1,repeat:r=1}=e,o=mC++,a={time:0,delay:t,duration:n,rate:s,repeat:r};return this._setChannelTime(a,this.time),this.channels.set(o,a),o}removeChannel(e){this.channels.delete(e);for(const[t,n]of this.animations)n.channel===e&&this.detachAnimation(t)}isFinished(e){const t=this.channels.get(e);return t===void 0?!1:this.time>=t.delay+t.duration*t.repeat}getTime(e){if(e===void 0)return this.time;const t=this.channels.get(e);return t===void 0?-1:t.time}setTime(e){this.time=Math.max(0,e);const t=this.channels.values();for(const s of t)this._setChannelTime(s,this.time);const n=this.animations.values();for(const s of n){const{animation:r,channel:o}=s;r.setTime(this.getTime(o))}}play(){this.playing=!0}pause(){this.playing=!1,this.lastEngineTime=-1}reset(){this.setTime(0)}attachAnimation(e,t){const n=yC++;return this.animations.set(n,{animation:e,channel:t}),e.setTime(this.getTime(t)),n}detachAnimation(e){this.animations.delete(e)}update(e){this.playing&&(this.lastEngineTime===-1&&(this.lastEngineTime=e),this.setTime(this.time+(e-this.lastEngineTime)),this.lastEngineTime=e)}_setChannelTime(e,t){const n=t-e.delay,s=e.duration*e.repeat;n>=s?e.time=e.duration*e.rate:(e.time=Math.max(0,n)%e.duration,e.time*=e.rate)}}function _C(i){const e=typeof window<"u"?window.requestAnimationFrame||window.webkitRequestAnimationFrame||window.mozRequestAnimationFrame:null;return e?e.call(window,i):setTimeout(()=>i(typeof performance<"u"?performance.now():Date.now()),1e3/60)}function bC(i){const e=typeof window<"u"?window.cancelAnimationFrame||window.webkitCancelAnimationFrame||window.mozCancelAnimationFrame:null;if(e){e.call(window,i);return}clearTimeout(i)}let vC=0;const xC="Animation Loop",nd={requestAnimationFrame:i=>_C(i),cancelAnimationFrame:i=>bC(i)};class Fl{static defaultAnimationLoopProps={device:null,onAddHTML:()=>"",onInitialize:async()=>null,onRender:()=>{},onFinalize:()=>{},onError:e=>{console.error(e)},stats:void 0,autoResizeViewport:!1,animationFrameProvider:nd};device=null;canvas=null;props;animationProps=null;timeline=null;stats;sharedStats;cpuTime;gpuTime;frameRate;display;_needsRedraw="initialized";_initialized=!1;_running=!1;_animationFrameId=null;_nextFramePromise=null;_resolveNextFrame=null;_cpuStartTime=0;_error=null;_lastFrameTime=0;constructor(e){if(this.props={...Fl.defaultAnimationLoopProps,...e},e=this.props,!e.device)throw new Error("No device provided");this.stats=e.stats||new Ur({id:`animation-loop-${vC++}`}),this.sharedStats=Ka.stats.get(xC),this.frameRate=this.stats.get("Frame Rate"),this.frameRate.setSampleSize(1),this.cpuTime=this.stats.get("CPU Time"),this.gpuTime=this.stats.get("GPU Time"),this.setProps({autoResizeViewport:e.autoResizeViewport,animationFrameProvider:e.animationFrameProvider}),this.start=this.start.bind(this),this.stop=this.stop.bind(this),this._onMousemove=this._onMousemove.bind(this),this._onMouseleave=this._onMouseleave.bind(this)}destroy(){this.stop(),this._setDisplay(null),this.device?._disableDebugGPUTime()}delete(){this.destroy()}reportError(e){this.props.onError(e),this._error=e}setNeedsRedraw(e){return this._needsRedraw=this._needsRedraw||e,this}needsRedraw(){const e=this._needsRedraw;return this._needsRedraw=!1,e}setProps(e){if("autoResizeViewport"in e&&(this.props.autoResizeViewport=e.autoResizeViewport||!1),"animationFrameProvider"in e){const t=e.animationFrameProvider||nd;if(t!==this.props.animationFrameProvider){const n=this._animationFrameId!==null;n&&this._cancelAnimationFrame(),this.props.animationFrameProvider=t,n&&this._requestAnimationFrame()}}return this}async start(){if(this._running)return this;this._running=!0;try{let e;if(!this._initialized){if(this._initialized=!0,await this._initDevice(),this._initialize(),!this._running)return null;await this.props.onInitialize(this._getAnimationProps())}return this._running?(e!==!1&&(this._cancelAnimationFrame(),this._requestAnimationFrame()),this):null}catch(e){const t=e instanceof Error?e:new Error("Unknown error");throw this.props.onError(t),t}}stop(){return this._running&&(this.animationProps&&!this._error&&this.props.onFinalize(this.animationProps),this._cancelAnimationFrame(),this._nextFramePromise=null,this._resolveNextFrame=null,this._running=!1,this._lastFrameTime=0),this}redraw(e,t=null){return this.device?.isLost||this._error?this:(this._beginFrameTimers(e),this._setupFrame(),this.animationProps&&(this.animationProps.animationFrame=t),this._updateAnimationProps(),this._renderFrame(this._getAnimationProps()),this._clearNeedsRedraw(),this._resolveNextFrame&&(this._resolveNextFrame(this),this._nextFramePromise=null,this._resolveNextFrame=null),this._endFrameTimers(),this)}attachTimeline(e){return this.timeline=e,this.timeline}detachTimeline(){this.timeline=null}waitForRender(){return this.setNeedsRedraw("waitForRender"),this._nextFramePromise||(this._nextFramePromise=new Promise(e=>{this._resolveNextFrame=e})),this._nextFramePromise}async toDataURL(){if(this.setNeedsRedraw("toDataURL"),await this.waitForRender(),this.canvas instanceof HTMLCanvasElement)return this.canvas.toDataURL();throw new Error("OffscreenCanvas")}_initialize(){this._startEventHandling(),this._initializeAnimationProps(),this._updateAnimationProps(),this._resizeViewport(),this.device?._enableDebugGPUTime()}_setDisplay(e){this.display&&(this.display.destroy(),this.display.animationLoop=null),e&&(e.animationLoop=this),this.display=e}_requestAnimationFrame(){this._running&&(this._animationFrameId=this.props.animationFrameProvider.requestAnimationFrame(this._animationFrame.bind(this)))}_cancelAnimationFrame(){this._animationFrameId!==null&&(this.props.animationFrameProvider.cancelAnimationFrame(this._animationFrameId),this._animationFrameId=null)}_animationFrame(e,t){this._running&&(this.redraw(e,t??null),this._requestAnimationFrame())}_renderFrame(e){if(this.display){this.display._renderFrame(e);return}const t=this.props.onRender(this._getAnimationProps());this.device&&t!==!1&&this.device.submit()}_clearNeedsRedraw(){this._needsRedraw=!1}_setupFrame(){this._resizeViewport()}_initializeAnimationProps(){const e=this.device?.getDefaultCanvasContext();if(!this.device||!e)throw new Error("loop");const t=e?.canvas,n=e.props.useDevicePixels;this.animationProps={animationLoop:this,device:this.device,canvasContext:e,canvas:t,useDevicePixels:n,timeline:this.timeline,needsRedraw:!1,width:1,height:1,aspect:1,time:0,startTime:Date.now(),engineTime:0,tick:0,tock:0,animationFrame:null,_mousePosition:null}}_getAnimationProps(){if(!this.animationProps)throw new Error("animationProps");return this.animationProps}_updateAnimationProps(){if(!this.animationProps)return;const{width:e,height:t,aspect:n}=this._getSizeAndAspect();(e!==this.animationProps.width||t!==this.animationProps.height)&&this.setNeedsRedraw("drawing buffer resized"),n!==this.animationProps.aspect&&this.setNeedsRedraw("drawing buffer aspect changed"),this.animationProps.width=e,this.animationProps.height=t,this.animationProps.aspect=n,this.animationProps.needsRedraw=this._needsRedraw,this.animationProps.engineTime=Date.now()-this.animationProps.startTime,this.timeline&&this.timeline.update(this.animationProps.engineTime),this.animationProps.tick=Math.floor(this.animationProps.time/1e3*60),this.animationProps.tock++,this.animationProps.time=this.timeline?this.timeline.getTime():this.animationProps.engineTime}async _initDevice(){if(this.device=await this.props.device,!this.device)throw new Error("No device provided");this.canvas=this.device.getDefaultCanvasContext().canvas||null}_createInfoDiv(){if(this.canvas&&this.props.onAddHTML){const e=document.createElement("div");document.body.appendChild(e),e.style.position="relative";const t=document.createElement("div");t.style.position="absolute",t.style.left="10px",t.style.bottom="10px",t.style.width="300px",t.style.background="white",this.canvas instanceof HTMLCanvasElement&&e.appendChild(this.canvas),e.appendChild(t);const n=this.props.onAddHTML(t);n&&(t.innerHTML=n)}}_getSizeAndAspect(){if(!this.device)return{width:1,height:1,aspect:1};const[e,t]=this.device.getDefaultCanvasContext().getDrawingBufferSize(),n=e>0&&t>0?e/t:1;return{width:e,height:t,aspect:n}}_resizeViewport(){this.props.autoResizeViewport&&this.device.gl&&this.device.gl.viewport(0,0,this.device.gl.drawingBufferWidth,this.device.gl.drawingBufferHeight)}_beginFrameTimers(e){const t=e??(typeof performance<"u"?performance.now():Date.now());if(this._lastFrameTime){const n=t-this._lastFrameTime;n>0&&this.frameRate.addTime(n)}this._lastFrameTime=t,this.device?._isDebugGPUTimeEnabled()&&this._consumeEncodedGpuTime(),this.cpuTime.timeStart()}_endFrameTimers(){this.device?._isDebugGPUTimeEnabled()&&this._consumeEncodedGpuTime(),this.cpuTime.timeEnd(),this._updateSharedStats()}_consumeEncodedGpuTime(){if(!this.device)return;const e=this.device.commandEncoder._gpuTimeMs;e!==void 0&&(this.gpuTime.addTime(e),this.device.commandEncoder._gpuTimeMs=void 0)}_updateSharedStats(){if(this.stats!==this.sharedStats){for(const e of Object.keys(this.sharedStats.stats))this.stats.stats[e]||delete this.sharedStats.stats[e];this.stats.forEach(e=>{const t=this.sharedStats.get(e.name,e.type);t.sampleSize=e.sampleSize,t.time=e.time,t.count=e.count,t.samples=e.samples,t.lastTiming=e.lastTiming,t.lastSampleTime=e.lastSampleTime,t.lastSampleCount=e.lastSampleCount,t._count=e._count,t._time=e._time,t._samples=e._samples,t._startTime=e._startTime,t._timerPending=e._timerPending})}}_startEventHandling(){this.canvas&&(this.canvas.addEventListener("mousemove",this._onMousemove.bind(this)),this.canvas.addEventListener("mouseleave",this._onMouseleave.bind(this)))}_onMousemove(e){e instanceof MouseEvent&&(this._getAnimationProps()._mousePosition=[e.offsetX,e.offsetY])}_onMouseleave(e){this._getAnimationProps()._mousePosition=null}}class sd{id;userData={};topology;bufferLayout=[];vertexCount;indices;attributes;constructor(e){if(this.id=e.id||rs("geometry"),this.topology=e.topology,this.indices=e.indices||null,this.attributes=e.attributes,this.vertexCount=e.vertexCount,this.bufferLayout=e.bufferLayout||[],this.indices&&!(this.indices.usage&q.INDEX))throw new Error("Index buffer must have INDEX usage")}destroy(){this.indices?.destroy();for(const e of Object.values(this.attributes))e.destroy()}getVertexCount(){return this.vertexCount}getAttributes(){return this.attributes}getIndexes(){return this.indices||null}_calculateVertexCount(e){return e.byteLength/12}}function wC(i,e){if(e instanceof sd)return e;const t=dC(e),n=PC(i,t),{attributes:s,bufferLayout:r}=SC(i,t);return new sd({topology:t.topology||"triangle-list",bufferLayout:r,vertexCount:t.vertexCount,indices:n,attributes:s})}function PC(i,e){if(!e.indices)return;const t=e.indices.value;return i.createBuffer({usage:q.INDEX,data:t})}function SC(i,e){const t={};for(const[n,s]of Object.entries(e.attributes)){const r=e.bufferLayout.find(o=>o.name===n)?.name||qn(n);s&&(t[r]=i.createBuffer({data:s.value,id:`${n}-buffer`}))}return{attributes:t,bufferLayout:e.bufferLayout,vertexCount:e.vertexCount}}function EC(i,e){const t={},n="Values";if(i.attributes.length===0&&!i.varyings?.length)return{"No attributes or varyings":{[n]:"N/A"}};for(const s of i.attributes)if(s){const r=`${s.location} ${s.name}: ${s.type}`;t[`in ${r}`]={[n]:s.stepMode||"vertex"}}for(const s of i.varyings||[]){const r=`${s.location} ${s.name}`;t[`out ${r}`]={[n]:JSON.stringify(s)}}return t}const rd="__debugFramebufferState",ea=8;function CC(i,e,t){if(i.device.type!=="webgl")return;const n=AC(i.device);if(!n.flushing){if(IC(i)){LC(i,t,n);return}e&&MC(e)&&e.handle!==null&&(n.queuedFramebuffers.includes(e)||n.queuedFramebuffers.push(e))}}function LC(i,e,t){if(t.queuedFramebuffers.length===0)return;const n=i.device,{gl:s}=n,r=s.getParameter(36010),o=s.getParameter(36006),[a,c]=i.device.getDefaultCanvasContext().getDrawingBufferSize();let l=od(e.top,ea);const u=od(e.left,ea);t.flushing=!0;try{for(const f of t.queuedFramebuffers){const[d,h,g,p,m]=TC({framebuffer:f,targetWidth:a,targetHeight:c,topPx:l,leftPx:u,minimap:e.minimap});s.bindFramebuffer(36008,f.handle),s.bindFramebuffer(36009,null),s.blitFramebuffer(0,0,f.width,f.height,d,h,g,p,16384,9728),l+=m+ea}}finally{s.bindFramebuffer(36008,r),s.bindFramebuffer(36009,o),t.flushing=!1}}function TC(i){const{framebuffer:e,targetWidth:t,targetHeight:n,topPx:s,leftPx:r}=i,o=Math.max(Math.floor(t/4),1),a=Math.max(Math.floor(n/4),1),c=Math.min(o/e.width,a/e.height),l=Math.max(Math.floor(e.width*c),1),u=Math.max(Math.floor(e.height*c),1),f=r,d=Math.max(n-s-u,0),h=f+l,g=d+u;return[f,d,h,g,u]}function AC(i){return i.userData[rd]||={flushing:!1,queuedFramebuffers:[]},i.userData[rd]}function MC(i){return"colorAttachments"in i}function IC(i){const e=i.props.framebuffer;return!e||e.handle===null}function od(i,e){if(!i)return e;const t=Number.parseInt(i,10);return Number.isFinite(t)?t:e}function Rn(i,e,t){if(i===e)return!0;if(!t||!i||!e)return!1;if(Array.isArray(i)){if(!Array.isArray(e)||i.length!==e.length)return!1;for(let n=0;n<i.length;n++)if(!Rn(i[n],e[n],t-1))return!1;return!0}if(Array.isArray(e))return!1;if(typeof i=="object"&&typeof e=="object"){const n=Object.keys(i),s=Object.keys(e);if(n.length!==s.length)return!1;for(const r of n)if(!e.hasOwnProperty(r)||!Rn(i[r],e[r],t-1))return!1;return!0}return!1}class ta{bufferLayouts;constructor(e){this.bufferLayouts=e}getBufferLayout(e){return this.bufferLayouts.find(t=>t.name===e)||null}getAttributeNamesForBuffer(e){return nc(e)}mergeBufferLayouts(e,t){const n=[...e];for(const s of t){const r=n.findIndex(o=>o.name===s.name);r<0?n.push(s):n[r]=s}return n}}function RC(i,e){const t=Fx(i),n=e.slice();return n.sort((s,r)=>{const o=of(nc(s).map(c=>t[c])),a=of(nc(r).map(c=>t[c]));return o-a}),n}function Mr(i,e){if(!i||!e.some(n=>n.bindingLayout?.length))return i;const t={...i,bindings:i.bindings.map(n=>({...n}))};"attributes"in(i||{})&&(t.attributes=i?.attributes||[]);for(const n of e)for(const s of n.bindingLayout||[])for(const r of BC(s.name)){const o=t.bindings.find(a=>a.name===r);o?.group===0&&(o.group=s.group),o&&s.visibility!==void 0&&(o.visibility=s.visibility)}return t}function OC(i,e,t=[]){return i?e?{...i,attributes:i.attributes.length?zC(i.attributes,e.attributes.filter(n=>t.includes(n.name))):e.attributes,bindings:FC(i.bindings,e.bindings)}:i:e}function zl(i){return!!(i.uniformTypes&&!DC(i.uniformTypes))}function kC(i){const e=[];for(const t of i){const n=ml(t),s=new Set([t.vs,t.fs].flatMap(o=>o?yl(o).filter(a=>a.isStd140).map(a=>a.blockName):[])),r=s.has(n)?n:s.size===1?s.values().next().value:void 0;zl(t)&&r&&e.push({name:r,uniformTypes:t.uniformTypes})}return e}function Xp(i,e){const t=[],n=new Set;for(const s of[...i||[],...e||[]])n.has(s.name)||(n.add(s.name),t.push(s));return t}function BC(i){const e=new Set([i,`${i}Uniforms`]);return i.endsWith("Uniforms")||e.add(`${i}Sampler`),[...e]}function DC(i){for(const e in i)return!1;return!0}function FC(i,e){const t=i.map(r=>({...r})),n=new Set(i.map(r=>r.name)),s=new Set(i.map(r=>`${r.group}:${r.location}`));for(const r of e){const o=`${r.group}:${r.location}`;!n.has(r.name)&&!s.has(o)&&t.push({...r})}return t}function zC(i,e){const t=i.map(r=>({...r})),n=new Map(i.map(r=>[r.name,r])),s=new Map(i.map(r=>[r.location,r]));for(const r of e){const o=n.get(r.name);if(o){if(o.type!==r.type||o.location!==r.location)throw new Error(`Shader attribute "${r.name}" conflicts with its inferred type or location`);continue}const a=s.get(r.location);if(a)throw new Error(`Shader attributes "${a.name}" and "${r.name}" both use location ${r.location}`);t.push({...r})}return t}function NC(i){return Ag(i)||typeof i=="number"||typeof i=="boolean"}function UC(i,e={}){const t={bindings:{},uniforms:{}};return Object.keys(i).forEach(n=>{const s=i[n];Object.prototype.hasOwnProperty.call(e,n)||NC(s)?t.uniforms[n]=s:t.bindings[n]=s}),t}class Kp{options={disableWarnings:!1};modules;moduleUniforms;moduleBindings;directBindings={};constructor(e,t){Object.assign(this.options,t);const n=_r(Object.values(e).filter($C));for(const s of n)e[s.name]=s;A.log(1,"Creating ShaderInputs with modules",Object.keys(e))(),this.modules=e,this.moduleUniforms={},this.moduleBindings={};for(const[s,r]of Object.entries(e))r&&(this._addModule(r),r.name&&s!==r.name&&!this.options.disableWarnings&&A.warn(`Module name: ${s} vs ${r.name}`)())}destroy(){}setProps(e){e.bindings&&Object.assign(this.directBindings,e.bindings);for(const t of Object.keys(e)){if(t==="bindings")continue;const n=t,s=e[n]||{},r=this.modules[n];if(!r)this.options.disableWarnings||A.warn(`Module ${t} not found`)();else{const o=this.moduleUniforms[n],a=this.moduleBindings[n],c=r.getUniforms?.(s,o)||s,{uniforms:l,bindings:u}=UC(c,r.uniformTypes);this.moduleUniforms[n]=ad(o,l,r.uniformTypes),this.moduleBindings[n]={...a,...u}}}}getModules(){return Object.values(this.modules)}addModules(e){const t=_r(e);for(const n of t){const s=n.name;this.modules[s]||(this.modules[s]=n,this._addModule(n))}}getUniformValues(){return this.moduleUniforms}getBindingValues(){const e={};for(const t of Object.values(this.moduleBindings))Object.assign(e,t);return Object.assign(e,this.directBindings),e}getModuleBindingValues(e){const t=this.moduleBindings[e];return t?{...t}:{}}getDebugTable(){const e={};for(const[t,n]of Object.entries(this.moduleUniforms))for(const[s,r]of Object.entries(n))e[`${t}.${s}`]={type:this.modules[t].uniformTypes?.[s],value:String(r)};return e}_addModule(e){const t=e.name;this.moduleUniforms[t]=ad({},e.defaultUniforms||{},e.uniformTypes),this.moduleBindings[t]={}}}function ad(i={},e={},t={}){const n={...i};for(const[s,r]of Object.entries(e))r!==void 0&&(n[s]=_c(i[s],r,t[s]));return n}function _c(i,e,t){if(!t||typeof t=="string")return On(e);if(Array.isArray(t)){if(bc(e)||!Array.isArray(e))return On(e);const o=Array.isArray(i)&&!bc(i)?[...i]:[],a=o.slice();for(let c=0;c<e.length;c++){const l=e[c];l!==void 0&&(a[c]=_c(o[c],l,t[0]))}return a}if(!vc(e))return On(e);const n=t,s=vc(i)?i:{},r={...s};for(const[o,a]of Object.entries(e))a!==void 0&&(r[o]=_c(s[o],a,n[o]));return r}function On(i){return ArrayBuffer.isView(i)?Array.prototype.slice.call(i):Array.isArray(i)?bc(i)?i.slice():i.map(t=>t===void 0?void 0:On(t)):vc(i)?Object.fromEntries(Object.entries(i).map(([e,t])=>[e,t===void 0?void 0:On(t)])):i}function bc(i){return ArrayBuffer.isView(i)||Array.isArray(i)&&(i.length===0||typeof i[0]=="number")}function vc(i){return!!i&&typeof i=="object"&&!Array.isArray(i)&&!ArrayBuffer.isView(i)}function $C(i){return!!i?.dependencies}const GC=q.DEBUG_DATA_MAX_LENGTH;class ct{device;id;ready;usage;props;isReady=!0;destroyed=!1;generation=0;updateTimestamp;debugData=new ArrayBuffer(0);_debugDataEnabled;_maxDebugDataByteLength;_ownsBuffer;_buffer;get buffer(){return this._buffer}get byteLength(){return this._buffer.byteLength}get[Symbol.toStringTag](){return"DynamicBuffer"}toString(){return`DynamicBuffer:"${this.id}":${this.byteLength}B`}toJSON(){return this.toString()}constructor(e,t){const{debugData:n=!1,buffer:s,ownsBuffer:r=!0,...o}=t;if(s&&s.device!==e)throw new Error("DynamicBuffer adopted buffers must belong to the supplied device");if(s&&(o.byteLength!==void 0||o.data!==void 0))throw new Error("DynamicBuffer cannot combine an adopted buffer with byteLength or data");const a=t.id||s?.id||rs("dynamic-buffer"),c={...o,id:a,usage:o.usage??s?.usage,indexType:o.indexType??s?.indexType};(c.usage||0)&q.INDEX&&!c.indexType&&(o.data instanceof Uint32Array?c.indexType="uint32":o.data instanceof Uint16Array?c.indexType="uint16":o.data instanceof Uint8Array&&(c.indexType="uint8")),delete c.data,delete c.byteOffset,this.device=e,this.id=a,this.props=c,this.usage=c.usage||0,this._debugDataEnabled=!!n,this._maxDebugDataByteLength=typeof n=="object"&&n.maxByteLength!==void 0?n.maxByteLength:GC,this._ownsBuffer=r,this._buffer=s??this.device.createBuffer({...o,id:a}),this.ready=Promise.resolve(this._buffer),this.updateTimestamp=this._buffer.updateTimestamp,this._resetDebugData(this._buffer.byteLength),o.data&&this._writeDebugData(o.data,o.byteOffset||0)}write(e,t=0){this._buffer.write(e,t),this._touch(),this._writeDebugData(e,t)}async mapAndWriteAsync(e,t=0,n=this.byteLength-t){let s=null;await this._buffer.mapAndWriteAsync(async(r,o)=>{await e(r,o),s=new Uint8Array(r.slice(0,n))},t,n),this._touch(),s&&this._writeDebugData(s,t)}async readAsync(e=0,t=this.byteLength-e){const n=await this._buffer.readAsync(e,t);return this._writeDebugData(n,e)&&this._touch(),n}async mapAndReadAsync(e,t=0,n=this.byteLength-t){let s=null;const r=await this._buffer.mapAndReadAsync(async(o,a)=>(s=new Uint8Array(o.slice(0)),await e(o,a)),t,n);return s&&this._writeDebugData(s,t)&&this._touch(),r}resize(e){const{byteLength:t,preserveData:n=!1}=e;if(t===this.byteLength)return!1;const s=Math.min(e.copyByteLength??Math.min(this.byteLength,t),this.byteLength,t),r=this._buffer,o=this.debugData.slice(0),{data:a,byteOffset:c,...l}=this.props,u=this.device.createBuffer({...l,byteLength:t});return n&&s>0&&this._copyBufferContents(r,u,s),this._buffer=u,this._resetDebugData(t),n&&o.byteLength>0&&this._writeDebugData(o,0),this._ownsBuffer&&r.destroy(),this._ownsBuffer=!0,this.generation++,this._touch(),!0}ensureSize(e,t){return e<=this.byteLength?!1:this.resize({byteLength:e,preserveData:t?.preserveData})}getBinding(e){return e?.offset===void 0&&e?.size===void 0?this._buffer:{buffer:this._buffer,offset:e?.offset,size:e?.size}}destroy(){this.destroyed||(this._ownsBuffer&&this._buffer.destroy(),this.destroyed=!0,this.debugData=new ArrayBuffer(0))}_copyBufferContents(e,t,n){const s=this.device.type==="webgpu"?Math.ceil(n/4)*4:n,r=this.device.createCommandEncoder();r.copyBufferToBuffer({sourceBuffer:e,destinationBuffer:t,size:s}),this.device.submit(r.finish())}_touch(){this.updateTimestamp=this.device.incrementTimestamp()}_resetDebugData(e){if(!this._debugDataEnabled){this.debugData=new ArrayBuffer(0);return}this.debugData=new ArrayBuffer(Math.min(e,this._maxDebugDataByteLength))}_writeDebugData(e,t){if(!this._debugDataEnabled||this.debugData.byteLength===0||t>=this.debugData.byteLength)return!1;const n=ArrayBuffer.isView(e)?new Uint8Array(e.buffer,e.byteOffset,e.byteLength):new Uint8Array(e),s=new Uint8Array(this.debugData),r=Math.min(n.byteLength,s.byteLength-t);return s.set(n.subarray(0,r),t),r>0}}function Qp(i){return i!==null&&typeof i=="object"&&"buffer"in i}function VC(i){return i instanceof ct?i.buffer:i}function jC(i){return{buffer:VC(i.buffer),offset:i.offset,size:i.size}}function Ys(i){return i!==null&&typeof i=="object"&&"resolveTextureBinding"in i&&typeof i.resolveTextureBinding=="function"}function WC(i){return i?.type==="texture"||i?.type==="external-texture"}function HC(i,e,t){const n=Xg(i,e,{ignoreWarnings:!0});return WC(n)?n:i.bindings.length===0&&t?.fallbackGroup!==void 0?{type:"texture",name:e,group:t.fallbackGroup,location:0}:null}const st=2,YC=1e4,ia="render pipeline initialization failed",qC=["stencil8","depth16unorm","depth24plus","depth24plus-stencil8","depth32float","depth32float-stencil8"];class ke{static defaultProps={...Bt.defaultProps,source:void 0,vs:null,fs:null,id:"unnamed",handle:void 0,userData:{},defines:{},modules:[],plugins:[],geometry:null,indexBuffer:null,indexCount:void 0,firstVertex:0,firstIndex:0,attributes:{},constantAttributes:{},bindings:{},uniforms:{},varyings:[],isInstanced:void 0,instanceCount:0,vertexCount:0,shaderInputs:void 0,material:void 0,pipelineFactory:void 0,shaderFactory:void 0,transformFeedback:void 0,shaderAssembler:Fe.getDefaultShaderAssembler("glsl"),debugShaders:void 0,disableWarnings:void 0};device;id;source;vs;fs;pipelineFactory;shaderFactory;userData={};parameters;topology;bufferLayout;isInstanced=void 0;instanceCount=0;vertexCount;indexCount;firstVertex;firstIndex;indexBuffer=null;bufferAttributes={};constantAttributes={};bindings={};vertexArray;transformFeedback=null;pipeline;shaderInputs;material=null;_uniformStore;_attributeInfos={};_gpuGeometry=null;props;_dynamicIndexBufferSource=null;_dynamicAttributeBufferSources={};_colorAttachmentFormats;_depthStencilAttachmentFormat;_pipelineNeedsUpdate="newly created";_needsRedraw="initializing";_drawBlockedReason=!1;_destroyed=!1;_lastDrawTimestamp=-1;_bindingTable=[];get[Symbol.toStringTag](){return"Model"}toString(){return`Model(${this.id})`}constructor(e,t){const n=ke.defaultProps.shaderAssembler;this.props={...ke.defaultProps,...t,shaderAssembler:t.shaderAssembler??(na(n,e.info.shadingLanguage)?n:Fe.getDefaultShaderAssembler(e.info.shadingLanguage))},t=this.props,this.id=t.id||rs("model"),this.device=e,Object.assign(this.userData,t.userData),this.material=t.material||null;const s=JC(e),r=rp(this.props.plugins,s.shaderLanguage),o=op(this.props.modules,r.modules),a=Object.fromEntries(o.map(d=>[d.name,d])),c=t.shaderInputs||new Kp(a,{disableWarnings:this.props.disableWarnings});t.shaderInputs&&r.modules.length>0&&c.addModules(r.modules),this.setShaderInputs(c);const l=Xp(this.props.modules,c.getModules()),u={...r.defines,...this.props.defines};if(this.device.type==="webgl"&&(this.props._uniformBlockLayouts=kC(l)),this.props.shaderLayout=Mr(this.props.shaderLayout,l)||null,this.device.type==="webgpu"&&this.props.source){const d=this.props.shaderAssembler;Gn(na(d,"wgsl"));const{source:h,getUniforms:g,bindingTable:p,shaderLayout:m}=d.assembleWGSLShader({platformInfo:s,...this.props,modules:l,defines:u,pluginInjections:r.injections,pluginVertexInputs:r.vertexInputs,pluginVaryings:r.varyings});this.source=h,this._getModuleUniforms=g,this._bindingTable=p;const _=m??e.getShaderLayout?.(this.source),v=ZC(_,r.vertexInputs),b=OC(this.props.shaderLayout,v,Object.keys(r.vertexInputs));this.props.shaderLayout=Mr(b||null,l)||null}else{const d=this.props.shaderAssembler;Gn(na(d,"glsl"));const{vs:h,fs:g,getUniforms:p}=d.assembleGLSLShaderPair({platformInfo:s,...this.props,modules:l,defines:u,pluginInjections:r.injections,pluginVertexInputs:r.vertexInputs,pluginVaryings:r.varyings});this.vs=h,this.fs=g,this._getModuleUniforms=p,this._bindingTable=[]}this.vertexCount=this.props.vertexCount,this.indexCount=this.props.indexCount,this.firstVertex=this.props.firstVertex,this.firstIndex=this.props.firstIndex,this.instanceCount=this.props.instanceCount,this.topology=this.props.topology,this.bufferLayout=this.props.bufferLayout,this.parameters=this.props.parameters,this._colorAttachmentFormats=this.props.colorAttachmentFormats,this._depthStencilAttachmentFormat=this.props.depthStencilAttachmentFormat,t.geometry&&this.setGeometry(t.geometry),this.pipelineFactory=t.pipelineFactory||Xr.getDefaultPipelineFactory(this.device),this.shaderFactory=t.shaderFactory||Kr.getDefaultShaderFactory(this.device),this.pipeline=this._updatePipeline(),this.vertexArray=e.createVertexArray({shaderLayout:this.pipeline.shaderLayout,bufferLayout:this.pipeline.bufferLayout}),this._gpuGeometry&&this._setGeometryAttributes(this._gpuGeometry),"isInstanced"in t&&(this.isInstanced=t.isInstanced),t.instanceCount&&this.setInstanceCount(t.instanceCount),t.vertexCount&&this.setVertexCount(t.vertexCount),t.indexBuffer&&this.setIndexBuffer(t.indexBuffer),t.attributes&&this.setAttributes(t.attributes),t.constantAttributes&&this.setConstantAttributes(t.constantAttributes),t.bindings&&this.setBindings(t.bindings),t.transformFeedback&&(this.transformFeedback=t.transformFeedback)}destroy(){this._destroyed||(this.pipelineFactory.release(this.pipeline),this.shaderFactory.release(this.pipeline.vs),this.pipeline.fs&&this.pipeline.fs!==this.pipeline.vs&&this.shaderFactory.release(this.pipeline.fs),this._uniformStore.destroy(),this._gpuGeometry?.destroy(),this._destroyed=!0)}needsRedraw(){this._getBindingsUpdateTimestamp()>this._lastDrawTimestamp&&this.setNeedsRedraw("contents of bound textures or buffers updated");const e=this._needsRedraw;return this._needsRedraw=!1,e}setNeedsRedraw(e){this._needsRedraw||=e}getBindingDebugTable(){return this._bindingTable}predraw(e){this._syncDynamicBuffers(),this.updateShaderInputs(e),this.material?.updateShaderInputs(e),this.pipeline=this._updatePipeline()}draw(e){if(this._drawBlockedReason&&!this._pipelineNeedsUpdate)return A.info(st,`>>> DRAWING ABORTED ${this.id}: ${this._drawBlockedReason}`)(),!1;const t=this._areBindingsLoading();if(t)return A.info(st,`>>> DRAWING ABORTED ${this.id}: ${t} not loaded`)(),!1;this._syncAttachmentFormats(e);try{e.pushDebugGroup(`${this}.predraw(${e})`),this.device.type==="webgpu"?(this.updateShaderInputs(),this.material?.updateShaderInputs(),this._syncDynamicBuffers(),this.pipeline=this._updatePipeline()):this.predraw(this.device.commandEncoder)}finally{e.popDebugGroup()}let n,s=this.pipeline.isErrored;try{if(e.pushDebugGroup(`${this}.draw(${e})`),this._logDrawCallStart(),this.pipeline=this._updatePipeline(),s=this.pipeline.isErrored,s)A.info(st,`>>> DRAWING ABORTED ${this.id}: ${ia}`)(),n=!1;else{const r=this.vertexArray.getDrawValidationError();if(r)A.info(st,`>>> DRAWING ABORTED ${this.id}: ${r}`)(),this._drawBlockedReason=r,n=!1;else{const o=this._getCurrentShaderLayout(),a=this._getBindings(o),c=this._getBindGroups(o,a),{indexBuffer:l}=this.vertexArray,u=l?this.indexCount??l.byteLength/(l.indexType==="uint32"?4:2):void 0;e.setPipeline(this.pipeline),e.setBindings(c,{_bindGroupCacheKeys:this._getBindGroupCacheKeys()}),e.setVertexArray(this.vertexArray),n=this.isInstanced===!0&&this.instanceCount===0?!0:e.draw({isInstanced:this.isInstanced,vertexCount:this.vertexCount,instanceCount:this.isInstanced?this.instanceCount:void 0,indexCount:u,firstVertex:this.firstVertex,firstIndex:this.firstIndex,transformFeedback:this.transformFeedback||void 0,uniforms:this.props.uniforms,parameters:this.parameters,topology:this.topology})}}}finally{e.popDebugGroup(),this._logDrawCallEnd()}return this._logFramebuffer(e),n?(this._lastDrawTimestamp=this.device.timestamp,this._needsRedraw=!1):s?(this._needsRedraw=ia,this._drawBlockedReason=ia):this._drawBlockedReason?this._needsRedraw=this._drawBlockedReason:this._needsRedraw="waiting for resource initialization",n}setGeometry(e){this._gpuGeometry?.destroy();const t=e&&wC(this.device,e);if(t){this.setTopology(t.topology||"triangle-list");const n=new ta(this.bufferLayout);this.bufferLayout=n.mergeBufferLayouts(t.bufferLayout,this.bufferLayout),this.vertexArray&&this._setGeometryAttributes(t)}this._gpuGeometry=t}setTopology(e){e!==this.topology&&(this.topology=e,this._setPipelineNeedsUpdate("topology"))}setBufferLayout(e){const t=new ta(this.bufferLayout),n=this._gpuGeometry?t.mergeBufferLayouts(e,this._gpuGeometry.bufferLayout):e;Rn(n,this.bufferLayout,-1)||(this.bufferLayout=n,this._setPipelineNeedsUpdate("bufferLayout"),this.pipeline=this._updatePipeline(),this.vertexArray=this.device.createVertexArray({shaderLayout:this.pipeline.shaderLayout,bufferLayout:this.pipeline.bufferLayout}),this._gpuGeometry&&this._setGeometryAttributes(this._gpuGeometry))}setParameters(e){Rn(e,this.parameters,2)||(this.parameters=e,this._setPipelineNeedsUpdate("parameters"))}setInstanceCount(e){this.instanceCount=e,this.isInstanced===void 0&&e>0&&(this.isInstanced=!0),this.setNeedsRedraw("instanceCount")}setVertexCount(e){this.vertexCount=e,this.setNeedsRedraw("vertexCount")}setIndexCount(e){this.indexCount=e,this.setNeedsRedraw("indexCount")}setDrawOffsets({firstVertex:e,firstIndex:t}){this.firstVertex=e,this.firstIndex=t,this.setNeedsRedraw("drawOffsets")}setShaderInputs(e){this.shaderInputs=e,this._uniformStore=new np(this.device,this.shaderInputs.modules);for(const[t,n]of Object.entries(this.shaderInputs.modules))if(zl(n)&&!this.material?.ownsModule(t)){const s=this._uniformStore.getManagedUniformBuffer(t);this.bindings[`${t}Uniforms`]=s}this.setNeedsRedraw("shaderInputs")}setMaterial(e){this.material=e,this.setNeedsRedraw("material")}updateShaderInputs(e){this._uniformStore.setUniforms(this.shaderInputs.getUniformValues(),e),this.setBindings(this._getNonMaterialBindings(this.shaderInputs.getBindingValues())),this.setNeedsRedraw("shaderInputs")}setBindings(e){Object.assign(this.bindings,e),this.setNeedsRedraw("bindings")}setTransformFeedback(e){this.transformFeedback=e,this.setNeedsRedraw("transformFeedback")}setIndexBuffer(e){const t=e instanceof ct?e.buffer:e;this.indexBuffer=t,this._dynamicIndexBufferSource=e instanceof ct?{source:e,generation:e.generation}:null,this.vertexArray.setIndexBuffer(t),this.setNeedsRedraw("indexBuffer")}setAttributes(e,t){this._drawBlockedReason=!1;const n=t?.disableWarnings??this.props.disableWarnings;e.indices&&A.warn(`Model:${this.id} setAttributes() - indexBuffer should be set using setIndexBuffer()`)(),this.bufferLayout=RC(this.pipeline.shaderLayout,this.bufferLayout);const s=new ta(this.bufferLayout);for(const[r,o]of Object.entries(e)){const a=o instanceof ct?o.buffer:o,c=s.getBufferLayout(r);if(!c){n||A.warn(`Model(${this.id}): Missing layout for buffer "${r}".`)();continue}const l=s.getAttributeNamesForBuffer(c);let u=!1;for(const f of l){const d=this._attributeInfos[f];if(d){const h=this.device.type==="webgpu"?this.vertexArray.getBufferSlot(d.bufferName):d.location;if(h===null){n||A.warn(`Model(${this.id}): Missing vertex array slot for buffer "${d.bufferName}".`)();continue}this.vertexArray.setBuffer(h,a),o instanceof ct?this._dynamicAttributeBufferSources[h]={source:o,generation:o.generation}:delete this._dynamicAttributeBufferSources[h],u=!0}}!u&&!n&&A.warn(`Model(${this.id}): Ignoring buffer "${a.id}" for unknown attribute "${r}"`)()}this.setNeedsRedraw("attributes")}setConstantAttributes(e,t){for(const[n,s]of Object.entries(e)){const r=this._attributeInfos[n];r?this.vertexArray.setConstantWebGL(r.location,s):(t?.disableWarnings??this.props.disableWarnings)||A.warn(`Model "${this.id}: Ignoring constant supplied for unknown attribute "${n}"`)()}this.setNeedsRedraw("constants")}_areBindingsLoading(){for(const e of Object.values(this.bindings))if(Ys(e)&&!e.isReady)return e.id;for(const e of Object.values(this.material?.bindings||{}))if(Ys(e)&&!e.isReady)return e.id;return!1}_getBindings(e=this._getCurrentShaderLayout()){const t={};for(const[n,s]of Object.entries(this.bindings)){const r=XC(n,s,e);r&&(t[n]=r)}return t}_getBindGroups(e=this._getCurrentShaderLayout(),t=this._getBindings(e)){const n=e.bindings.length?ol(e,t):{0:t};if(!this.material)return n;for(const[s,r]of Object.entries(this.material.getBindingsByGroup(e))){const o=Number(s);n[o]={...n[o]||{},...r}}return n}_getBindGroupCacheKeys(){const e=this.material?.getBindGroupCacheKey(3);return e?{3:e}:{}}_getBindingsUpdateTimestamp(){let e=0;this._dynamicIndexBufferSource&&(e=Math.max(e,this._dynamicIndexBufferSource.source.updateTimestamp));for(const t of Object.values(this._dynamicAttributeBufferSources))e=Math.max(e,t.source.updateTimestamp);for(const t of Object.values(this.bindings))t instanceof Yr?e=Math.max(e,t.texture.updateTimestamp):t instanceof q||t instanceof re||t instanceof rl||t instanceof ct?e=Math.max(e,t.updateTimestamp):Ys(t)?e=t.isReady?Math.max(e,t.updateTimestamp):1/0:Qp(t)&&(e=Math.max(e,(t.buffer instanceof ct,t.buffer.updateTimestamp)));return Math.max(e,this.material?.getBindingsUpdateTimestamp()||0)}_setGeometryAttributes(e){const t={...e.attributes};for(const[n]of Object.entries(t))!this.pipeline.shaderLayout.attributes.find(s=>s.name===n)&&n!=="positions"&&delete t[n];this.vertexCount=e.vertexCount,this.setIndexBuffer(e.indices||null),this.setAttributes(e.attributes,{disableWarnings:!0}),this.setAttributes(t,{disableWarnings:this.props.disableWarnings}),this.setNeedsRedraw("geometry attributes")}_setPipelineNeedsUpdate(e){this._pipelineNeedsUpdate||=e,this._drawBlockedReason=!1,this.setNeedsRedraw(e)}_updatePipeline(){if(this._pipelineNeedsUpdate){let e=null,t=null;this.pipeline&&(A.log(1,`Model ${this.id}: Recreating pipeline because "${this._pipelineNeedsUpdate}".`)(),e=this.pipeline.vs,t=this.pipeline.fs),this._pipelineNeedsUpdate=!1;const n=this.shaderFactory.createShader({id:`${this.id}-vertex`,stage:"vertex",source:this.source||this.vs,debugShaders:this.props.debugShaders});let s=null;this.source?s=n:this.fs&&(s=this.shaderFactory.createShader({id:`${this.id}-fragment`,stage:"fragment",source:this.source||this.fs,debugShaders:this.props.debugShaders})),this.pipeline=this.pipelineFactory.createRenderPipeline({...this.props,bindings:void 0,bufferLayout:this.bufferLayout,colorAttachmentFormats:this._colorAttachmentFormats,depthStencilAttachmentFormat:this._depthStencilAttachmentFormat,topology:this.topology,parameters:this.parameters,bindGroups:void 0,vs:n,fs:s}),this._attributeInfos=sp(this.pipeline.shaderLayout,this.bufferLayout),e&&this.shaderFactory.release(e),t&&t!==e&&this.shaderFactory.release(t)}return this.pipeline}_lastLogTime=0;_logOpen=!1;_logDrawCallStart(){const e=A.level>3?0:YC;A.level<2||Date.now()-this._lastLogTime<e||(this._lastLogTime=Date.now(),this._logOpen=!0,A.group(st,`>>> DRAWING MODEL ${this.id}`,{collapsed:A.level<=2})())}_logDrawCallEnd(){if(this._logOpen){const e=EC(this.pipeline.shaderLayout,this.id);A.table(st,e)();const t=this.shaderInputs.getDebugTable();A.table(st,t)();const n=this._getAttributeDebugTable();A.table(st,this._attributeInfos)(),A.table(st,n)(),A.groupEnd(st)(),this._logOpen=!1}}_drawCount=0;_logFramebuffer(e){const t=this.device.props.debugFramebuffers;if(this._drawCount++,!t)return;const n=e.props.framebuffer;CC(e,n,{id:n?.id||`${this.id}-framebuffer`,minimap:!0})}_getAttributeDebugTable(){const e={};for(const[t,n]of Object.entries(this._attributeInfos)){const s=this.vertexArray.attributes[n.location];e[n.location]={name:t,type:n.shaderType,values:s?this._getBufferOrConstantValues(s,n.bufferDataType):"null"}}if(this.vertexArray.indexBuffer){const{indexBuffer:t}=this.vertexArray,n=t.indexType==="uint32"?new Uint32Array(t.debugData):new Uint16Array(t.debugData);e.indices={name:"indices",type:t.indexType,values:n.toString()}}return e}_getBufferOrConstantValues(e,t){const n=mt.getTypedArrayConstructor(t);return(e instanceof q?new n(e.debugData):e).toString()}_getNonMaterialBindings(e){if(!this.material)return e;const t={};for(const[n,s]of Object.entries(e))this.material.ownsBinding(n)||(t[n]=s);return t}_getCurrentShaderLayout(){return this.pipeline?.shaderLayout||this.props.shaderLayout||{bindings:[]}}_syncDynamicBuffers(){if(this._dynamicIndexBufferSource&&this._dynamicIndexBufferSource.generation!==this._dynamicIndexBufferSource.source.generation){const e=this._dynamicIndexBufferSource.source.buffer;this.indexBuffer=e,this.vertexArray.setIndexBuffer(e),this._dynamicIndexBufferSource.generation=this._dynamicIndexBufferSource.source.generation,this.setNeedsRedraw("dynamic index buffer")}for(const[e,t]of Object.entries(this._dynamicAttributeBufferSources))t.generation!==t.source.generation&&(this.vertexArray.setBuffer(Number(e),t.source.buffer),t.generation=t.source.generation,this.setNeedsRedraw("dynamic attribute buffer"))}_syncAttachmentFormats(e){if(this.device.type!=="webgpu")return;const t=e.framebuffer||e.props.framebuffer,n=e.props,s=n.colorAttachmentFormats??t?.colorAttachments?.map(o=>KC(o?.texture?.format)),r=n.depthStencilAttachmentFormat===!1?void 0:n.depthStencilAttachmentFormat??QC(t?.depthStencilAttachment?.texture?.format);(!Rn(this._colorAttachmentFormats,s,1)||this._depthStencilAttachmentFormat!==r)&&(this._colorAttachmentFormats=s,this._depthStencilAttachmentFormat=r,this._setPipelineNeedsUpdate("attachment formats"))}}function na(i,e){return i.shaderLanguage!==void 0&&i.shaderLanguage!==e?!1:e==="glsl"?"assembleGLSLShaderPair"in i&&typeof i.assembleGLSLShaderPair=="function":"assembleWGSLShader"in i&&typeof i.assembleWGSLShader=="function"}function ZC(i,e){return!i||Object.keys(e).length===0?i:{...i,attributes:i.attributes.map(t=>{const n=t.name.startsWith("_luma_")?t.name.slice(6):null;return n&&e[n]?{...t,name:n}:t})}}function XC(i,e,t){if(Ys(e)){const n=HC(t,i,{fallbackGroup:0});return n?e.resolveTextureBinding(n):null}return e instanceof ct?e.buffer:Qp(e)?jC(e):e}function KC(i){return i&&!Jp(i)?i:null}function QC(i){return i&&Jp(i)?i:void 0}function Jp(i){return qC.includes(i)}function JC(i){return{type:i.type,shaderLanguage:i.info.shadingLanguage,shaderLanguageVersion:i.info.shadingLanguageVersion,gpu:i.info.gpu,limits:i.limits,features:i.features}}const eL=35980,tL=35981;class Ki{device;model;transformFeedback;static defaultProps={...ke.defaultProps,feedbackBufferMode:"separate",outputs:void 0,feedbackBuffers:void 0};static isSupported(e){return e?.info?.type==="webgl"}constructor(e,t=Ki.defaultProps){if(!Ki.isSupported(e))throw new Error("BufferTransform not yet implemented on WebGPU");this.device=e,this.model=new ke(this.device,{id:t.id||"buffer-transform-model",fs:t.fs||SP(),topology:t.topology||"point-list",varyings:t.outputs||t.varyings,...t,bufferMode:t.bufferMode||(t.feedbackBufferMode==="interleaved"?eL:tL)}),this.transformFeedback=this.device.createTransformFeedback({layout:this.model.pipeline.shaderLayout,buffers:t.feedbackBuffers}),this.model.setTransformFeedback(this.transformFeedback)}destroy(){this.model&&this.model.destroy()}delete(){this.destroy()}run(e){e?.inputBuffers&&this.model.setAttributes(e.inputBuffers),e?.outputBuffers&&this.transformFeedback.setBuffers(e.outputBuffers);const t=this.device.beginRenderPass({discard:!0,...e});this.model.draw(t),t.end()}getBuffer(e){return this.transformFeedback.getBuffer(e)}readAsync(e){const t=this.getBuffer(e);if(!t)throw new Error("BufferTransform#getBuffer");if(t instanceof q)return t.readAsync();const{buffer:n,byteOffset:s=0,byteLength:r=n.byteLength}=t;return n.readAsync(s,r)}}const sa=2,iL=1e4;class Nl{static defaultProps={...jn.defaultProps,id:"unnamed",handle:void 0,userData:{},source:"",modules:[],defines:{},plugins:[],bindings:void 0,shaderInputs:void 0,pipelineFactory:void 0,shaderFactory:void 0,shaderAssembler:Fe.getDefaultShaderAssembler("wgsl"),debugShaders:void 0};device;id;pipelineFactory;shaderFactory;userData={};bindings={};pipeline;source;shader;shaderInputs;_uniformStore;_pipelineNeedsUpdate="newly created";_getModuleUniforms;props;_destroyed=!1;constructor(e,t){if(e.type!=="webgpu")throw new Error("Computation is only supported in WebGPU");this.props={...Nl.defaultProps,...t},t=this.props,this.id=t.id||rs("model"),this.device=e,Object.assign(this.userData,t.userData);const n=nL(e),s=rp(this.props.plugins,n.shaderLanguage);if(Object.keys(s.vertexInputs).length>0||Object.keys(s.varyings).length>0)throw new Error("Computation does not support ShaderPlugin vertex inputs or varyings");const r=op(this.props.modules,s.modules),o=Object.fromEntries(r.map(g=>[g.name,g]));this.shaderInputs=t.shaderInputs||new Kp(o),t.shaderInputs&&s.modules.length>0&&this.shaderInputs.addModules(s.modules),this.setShaderInputs(this.shaderInputs);const a=Xp(this.props.modules,this.shaderInputs?.getModules()),c={...s.defines,...this.props.defines};this.props.shaderLayout=Mr(this.props.shaderLayout,a)||null,this.pipelineFactory=t.pipelineFactory||Xr.getDefaultPipelineFactory(this.device),this.shaderFactory=t.shaderFactory||Kr.getDefaultShaderFactory(this.device);const l=this.props.shaderAssembler;Gn(l instanceof Yi);const{source:u,getUniforms:f,shaderLayout:d}=l.assembleWGSLShader({platformInfo:n,...this.props,modules:a,defines:c,scanVertexAttributes:!1,pluginInjections:s.injections});this.source=u,this._getModuleUniforms=f;const h=d??e.getShaderLayout?.(this.source,{scanVertexAttributes:!1});this.props.shaderLayout=Mr(this.props.shaderLayout||h||null,a)||null,this.pipeline=this._updatePipeline(),t.bindings&&this.setBindings(t.bindings)}destroy(){this._destroyed||(this.pipelineFactory.release(this.pipeline),this.shaderFactory.release(this.shader),this._uniformStore.destroy(),this._destroyed=!0)}predraw(e){this.updateShaderInputs(e)}dispatch(e,t,n,s){try{this._logDrawCallStart(),this._setPipeline(e),e.dispatch(t,n,s)}finally{this._logDrawCallEnd()}}dispatchIndirect(e,t,n=0){try{this._logDrawCallStart(),this._setPipeline(e),e.dispatchIndirect(t,n)}finally{this._logDrawCallEnd()}}_setPipeline(e){this.pipeline=this._updatePipeline(),this.pipeline.setBindings(this.bindings),e.setPipeline(this.pipeline),e.setBindings({})}setVertexCount(e){}setInstanceCount(e){}setShaderInputs(e){this.shaderInputs=e,this._uniformStore=new np(this.device,this.shaderInputs.modules);for(const[t,n]of Object.entries(this.shaderInputs.modules))if(zl(n)){const s=this._uniformStore.getManagedUniformBuffer(t);this.bindings[`${t}Uniforms`]=s}}setShaderModuleProps(e){const t=this._getModuleUniforms(e),n=Object.keys(t).filter(s=>{const r=t[s];return!Ag(r)&&typeof r!="number"&&typeof r!="boolean"});for(const s of n)t[s],delete t[s]}updateShaderInputs(e){this._uniformStore.setUniforms(this.shaderInputs.getUniformValues(),e)}setBindings(e){Object.assign(this.bindings,e)}_setPipelineNeedsUpdate(e){this._pipelineNeedsUpdate=this._pipelineNeedsUpdate||e}_updatePipeline(){if(this._pipelineNeedsUpdate){let e=null;this.pipeline&&(A.log(1,`Model ${this.id}: Recreating pipeline because "${this._pipelineNeedsUpdate}".`)(),e=this.shader),this._pipelineNeedsUpdate=!1,this.shader=this.shaderFactory.createShader({id:`${this.id}-fragment`,stage:"compute",source:this.source,debugShaders:this.props.debugShaders}),this.pipeline=this.pipelineFactory.createComputePipeline({...this.props,shader:this.shader}),e&&this.shaderFactory.release(e)}return this.pipeline}_lastLogTime=0;_logOpen=!1;_logDrawCallStart(){const e=A.level>3?0:iL;A.level<2||Date.now()-this._lastLogTime<e||(this._lastLogTime=Date.now(),this._logOpen=!0,A.group(sa,`>>> DRAWING MODEL ${this.id}`,{collapsed:A.level<=2})())}_logDrawCallEnd(){if(this._logOpen){const e=this.shaderInputs.getDebugTable();A.table(sa,e)(),A.groupEnd(sa)(),this._logOpen=!1}}_drawCount=0;_getBufferOrConstantValues(e,t){const n=mt.getTypedArrayConstructor(t);return(e instanceof q?new n(e.debugData):e).toString()}}function nL(i){return{type:i.type,shaderLanguage:i.info.shadingLanguage,shaderLanguageVersion:i.info.shadingLanguageVersion,gpu:i.info.gpu,limits:i.limits,features:i.features}}const sL={blendColorOperation:"add",blendColorSrcFactor:"one",blendColorDstFactor:"zero",blendAlphaOperation:"add",blendAlphaSrcFactor:"constant",blendAlphaDstFactor:"zero"};class em extends Bl{constructor(){super(...arguments),this._colorEncoderState=null}render(e){return"pickingFBO"in e?this._drawPickingBuffer(e):{decodePickingColor:null,stats:super._render(e)}}_drawPickingBuffer({layers:e,layerFilter:t,views:n,viewports:s,onViewportActive:r,pickingFBO:o,deviceRect:{x:a,y:c,width:l,height:u},cullRect:f,effects:d,pass:h="picking",pickZ:g,canvasContext:p,shaderModuleProps:m,clearColor:_}){this.pickZ=g;const v=this._resetColorEncoder(g),b=[a,c,l,u],x=super._render({target:o,layers:e,layerFilter:t,views:n,viewports:s,onViewportActive:r,cullRect:f,effects:d?.filter(C=>C.useInPicking),pass:h,canvasContext:p,isPicking:!0,shaderModuleProps:m,clearColor:_??[0,0,0,0],colorMask:15,scissorRect:b});return this._colorEncoderState=null,{decodePickingColor:v&&rL.bind(null,v),stats:x}}shouldDrawLayer(e){const{pickable:t,operation:n}=e.props;return t&&n.includes("draw")||n.includes("terrain")||n.includes("mask")}getShaderModuleProps(e,t,n){return{picking:{isActive:1,isAttribute:this.pickZ,disabledPickingIndices:e.internalState?.disabledPickingIndices},lighting:{enabled:!1}}}getLayerParameters(e,t,n){const s={...e.props.parameters},{pickable:r,operation:o}=e.props;return this._colorEncoderState?r&&o.includes("draw")?(Object.assign(s,sL),s.blend=!0,this.device.type==="webgpu"?s.blendConstant=cd(this._colorEncoderState,e,n):s.blendColor=cd(this._colorEncoderState,e,n),o.includes("terrain")&&e.state?._hasPickingCover&&(s.blendAlphaSrcFactor="one")):o.includes("terrain")&&(s.blend=!1):s.blend=!1,s}_resetColorEncoder(e){return this._colorEncoderState=e?null:{byLayer:new Map,byAlpha:[]},this._colorEncoderState}}function cd(i,e,t){const{byLayer:n,byAlpha:s}=i;let r,o=n.get(e);return o?(o.viewports.push(t),r=o.a):(r=n.size+1,r<=255?(o={a:r,layer:e,viewports:[t]},n.set(e,o),s[r]=o):(K.warn("Too many pickable layers, only picking the first 255")(),r=0)),[0,0,0,r/255]}function rL(i,e){const t=i.byAlpha[e[3]];return t&&{pickedLayer:t.layer,pickedViewports:t.viewports,pickedObjectIndex:t.layer.decodePickingColor(e)}}const Ii={NO_STATE:"Awaiting state",MATCHED:"Matched. State transferred from previous layer",INITIALIZED:"Initialized",AWAITING_GC:"Discarded. Awaiting garbage collection",AWAITING_FINALIZATION:"No longer matched. Awaiting garbage collection",FINALIZED:"Finalized! Awaiting garbage collection"},Ir=Symbol.for("component"),$t=Symbol.for("propTypes"),ra=Symbol.for("deprecatedProps"),$i=Symbol.for("asyncPropDefaults"),fi=Symbol.for("asyncPropOriginal"),Dt=Symbol.for("asyncPropResolved");function Ul(i,e=()=>!0){return Array.isArray(i)?tm(i,e,[]):e(i)?[i]:[]}function tm(i,e,t){let n=-1;for(;++n<i.length;){const s=i[n];Array.isArray(s)?tm(s,e,t):e(s)&&t.push(s)}return t}function oL({target:i,source:e,start:t=0,count:n=1}){const s=e.length,r=n*s;let o=0;for(let a=t;o<s;o++)i[a++]=e[o];for(;o<r;)o<r-o?(i.copyWithin(t+o,t,t+o),o*=2):(i.copyWithin(t+o,t,t+r-o),o=r);return i}class aL{constructor(e,t,n){this._loadCount=0,this._subscribers=new Set,this.id=e,this.context=n,this.setData(t)}subscribe(e){this._subscribers.add(e)}unsubscribe(e){this._subscribers.delete(e)}inUse(){return this._subscribers.size>0}delete(){}getData(){return this.isLoaded?this._error?Promise.reject(this._error):this._content:this._loader.then(()=>this.getData())}setData(e,t){if(e===this._data&&!t)return;this._data=e;const n=++this._loadCount;let s=e;typeof e=="string"&&(s=gr(e)),s instanceof Promise?(this.isLoaded=!1,this._loader=s.then(r=>{this._loadCount===n&&(this.isLoaded=!0,this._error=void 0,this._content=r)}).catch(r=>{this._loadCount===n&&(this.isLoaded=!0,this._error=r||!0)})):(this.isLoaded=!0,this._error=void 0,this._content=e);for(const r of this._subscribers)r.onChange(this.getData())}}class cL{constructor(e){this.protocol=e.protocol||"resource://",this._context={device:e.device,gl:e.device?.gl,resourceManager:this},this._resources={},this._consumers={},this._pruneRequest=null}contains(e){return e.startsWith(this.protocol)?!0:e in this._resources}add({resourceId:e,data:t,forceUpdate:n=!1,persistent:s=!0}){let r=this._resources[e];r?r.setData(t,n):(r=new aL(e,t,this._context),this._resources[e]=r),r.persistent=s}remove(e){const t=this._resources[e];t&&(t.delete(),delete this._resources[e])}unsubscribe({consumerId:e}){const t=this._consumers[e];if(t){for(const n in t){const s=t[n],r=this._resources[s.resourceId];r&&r.unsubscribe(s)}delete this._consumers[e],this.prune()}}subscribe({resourceId:e,onChange:t,consumerId:n,requestId:s="default"}){const{_resources:r,protocol:o}=this;e.startsWith(o)&&(e=e.replace(o,""),r[e]||this.add({resourceId:e,data:null,persistent:!1}));const a=r[e];if(this._track(n,s,a,t),a)return a.getData()}prune(){this._pruneRequest||(this._pruneRequest=setTimeout(()=>this._prune(),0))}finalize(){for(const e in this._resources)this._resources[e].delete()}_track(e,t,n,s){const r=this._consumers,o=r[e]=r[e]||{};let a=o[t];const c=a&&a.resourceId&&this._resources[a.resourceId];c&&(c.unsubscribe(a),this.prune()),n&&(a?(a.onChange=s,a.resourceId=n.id):a={onChange:s,resourceId:n.id},o[t]=a,n.subscribe(a))}_prune(){this._pruneRequest=null;for(const e of Object.keys(this._resources)){const t=this._resources[e];!t.persistent&&!t.inUse()&&(t.delete(),delete this._resources[e])}}}const lL="layerManager.setLayers",uL="layerManager.activateViewport";class fL{constructor(e,t){this._lastRenderedLayers=[],this._needsRedraw=!1,this._needsUpdate=!1,this._nextLayers=null,this._debug=!1,this._defaultShaderModulesChanged=!1,this.activateViewport=a=>{Se(uL,this,a),a&&(this.context.viewport=a)};const{deck:n,stats:s,viewport:r,timeline:o}=t||{};this.layers=[],this.resourceManager=new cL({device:e,protocol:"deck://"}),this.context={mousePosition:null,userData:{},layerManager:this,device:e,gl:e?.gl,deck:n,shaderAssembler:NE(e?.info?.shadingLanguage||"glsl"),defaultShaderModules:[wS],renderPass:void 0,stats:s||new Ur({id:"deck.gl"}),viewport:r||new an({id:"DEFAULT-INITIAL-VIEWPORT"}),timeline:o||new Zp,resourceManager:this.resourceManager,onError:void 0},Object.seal(this)}finalize(){this.resourceManager.finalize();for(const e of this.layers)this._finalizeLayer(e)}needsRedraw(e={clearRedrawFlags:!1}){let t=this._needsRedraw;e.clearRedrawFlags&&(this._needsRedraw=!1);for(const n of this.layers){const s=n.getNeedsRedraw(e);t=t||s}return t}needsUpdate(){return this._nextLayers&&this._nextLayers!==this._lastRenderedLayers?"layers changed":this._defaultShaderModulesChanged?"shader modules changed":this._needsUpdate}setNeedsRedraw(e){this._needsRedraw=this._needsRedraw||e}setNeedsUpdate(e){this._needsUpdate=this._needsUpdate||e}getLayers({layerIds:e}={}){return e?this.layers.filter(t=>e.find(n=>t.id.indexOf(n)===0)):this.layers}setProps(e){"debug"in e&&(this._debug=e.debug),"userData"in e&&(this.context.userData=e.userData),"layers"in e&&(this._nextLayers=e.layers),"onError"in e&&(this.context.onError=e.onError)}setLayers(e,t){Se(lL,this,t,e),this._lastRenderedLayers=e;const n=Ul(e,Boolean);for(const s of n)s.context=this.context;this._updateLayers(this.layers,n)}updateLayers(){const e=this.needsUpdate();e&&(this.setNeedsRedraw(`updating layers: ${e}`),this.setLayers(this._nextLayers||this._lastRenderedLayers,e)),this._nextLayers=null}addDefaultShaderModule(e){const{defaultShaderModules:t}=this.context;t.find(n=>n.name===e.name)||(t.push(e),this._defaultShaderModulesChanged=!0)}removeDefaultShaderModule(e){const{defaultShaderModules:t}=this.context,n=t.findIndex(s=>s.name===e.name);n>=0&&(t.splice(n,1),this._defaultShaderModulesChanged=!0)}_handleError(e,t,n){n.raiseError(t,`${e} of ${n}`)}_updateLayers(e,t){const n={};for(const o of e)n[o.id]?K.warn(`Multiple old layers with same id ${o.id}`)():n[o.id]=o;if(this._defaultShaderModulesChanged){for(const o of e)o.setNeedsUpdate(),o.setChangeFlags({extensionsChanged:!0});this._defaultShaderModulesChanged=!1}const s=[];this._updateSublayersRecursively(t,n,s),this._finalizeOldLayers(n);let r=!1;for(const o of s)if(o.hasUniformTransition()){r=`Uniform transition in ${o}`;break}this._needsUpdate=r,this.layers=s}_updateSublayersRecursively(e,t,n){for(const s of e){s.context=this.context;const r=t[s.id];r===null&&K.warn(`Multiple new layers with same id ${s.id}`)(),t[s.id]=null;let o=null;try{this._debug&&r!==s&&s.validateProps(),r?(this._transferLayerState(r,s),this._updateLayer(s)):this._initializeLayer(s),n.push(s),o=s.isComposite?s.getSubLayers():null}catch(a){this._handleError("matching",a,s)}o&&this._updateSublayersRecursively(o,t,n)}}_finalizeOldLayers(e){for(const t in e){const n=e[t];n&&this._finalizeLayer(n)}}_initializeLayer(e){try{e._initialize(),e.lifecycle=Ii.INITIALIZED}catch(t){this._handleError("initialization",t,e)}}_transferLayerState(e,t){t._transferState(e),t.lifecycle=Ii.MATCHED,t!==e&&(e.lifecycle=Ii.AWAITING_GC)}_updateLayer(e){try{e._update()}catch(t){this._handleError("update",t,e)}}_finalizeLayer(e){this._needsRedraw=this._needsRedraw||`finalized ${e}`,e.lifecycle=Ii.AWAITING_FINALIZATION;try{e._finalize(),e.lifecycle=Ii.FINALIZED}catch(t){this._handleError("finalization",t,e)}}}function Me(i,e,t){if(i===e)return!0;if(!t||!i||!e)return!1;if(Array.isArray(i)){if(!Array.isArray(e)||i.length!==e.length)return!1;for(let n=0;n<i.length;n++)if(!Me(i[n],e[n],t-1))return!1;return!0}if(Array.isArray(e))return!1;if(typeof i=="object"&&typeof e=="object"){const n=Object.keys(i),s=Object.keys(e);if(n.length!==s.length)return!1;for(const r of n)if(!e.hasOwnProperty(r)||!Me(i[r],e[r],t-1))return!1;return!0}return!1}const Gi="default-canvas";class dL{constructor(e){this.views=[],this.width=100,this.height=100,this.viewState={},this.controllers={},this.timeline=e.timeline,this._viewports=[],this._viewportMap={},this._isUpdating=!1,this._needsRedraw="First render",this._needsUpdate="Initialize",this._eventManager=e.eventManager,this._eventManagers=e.eventManagers||{},this._viewEventManagers={},this._eventCallbacks={onViewStateChange:e.onViewStateChange,onInteractionStateChange:e.onInteractionStateChange},this._pickPosition=e.pickPosition,this._getCanvasContext=e.getCanvasContext,Object.seal(this),this.setProps(e)}finalize(){for(const e in this.controllers){const t=this.controllers[e];t&&t.finalize()}this.controllers={}}needsRedraw(e={clearRedrawFlags:!1}){const t=this._needsRedraw;return e.clearRedrawFlags&&(this._needsRedraw=!1),t}setNeedsUpdate(e){this._needsUpdate=this._needsUpdate||e,this._needsRedraw=this._needsRedraw||e}updateViewStates(){for(const e in this.controllers){const t=this.controllers[e];t&&t.updateTransition()}}getViewports(e){return e?this._viewports.filter(t=>{const n=!e.canvasId||this.getCanvasId(t.id)===e.canvasId,s=!("x"in e)||t.containsPixel(e);return n&&s}):this._viewports}getViews(){const e={};return this.views.forEach(t=>{e[t.id]=t}),e}getView(e){return this.views.find(t=>t.id===e)}getViewState(e){const t=typeof e=="string"?this.getView(e):e,n=t&&this.viewState[t.getViewStateId()]||this.viewState;return t?t.filterViewState(n):n}getViewport(e){return this._viewportMap[e]}getCanvasId(e){const t=typeof e=="string"?this.getView(e):e;return t?this._viewEventManagers[t.id]?.canvasId||this._getCanvasIdFromView(t):void 0}unproject(e,t){const n=this.getViewports(),s={x:e[0],y:e[1]};for(let r=n.length-1;r>=0;--r){const o=n[r];if(o.containsPixel(s)){const a=e.slice();return a[0]-=o.x,a[1]-=o.y,o.unproject(a,t)}}return null}setProps(e){e.views&&this._setViews(e.views),e.viewState&&this._setViewState(e.viewState),("width"in e||"height"in e)&&this._setSize(e.width,e.height),"pickPosition"in e&&(this._pickPosition=e.pickPosition),"eventManagers"in e&&this._setEventManagers(e.eventManagers||{}),this._isUpdating||this._update()}_update(){this._isUpdating=!0,this._needsUpdate&&(this._needsUpdate=!1,this._rebuildViewports()),this._needsUpdate&&(this._needsUpdate=!1,this._rebuildViewports()),this._isUpdating=!1}_setSize(e,t){(e!==this.width||t!==this.height)&&(this.width=e,this.height=t,this.setNeedsUpdate("Size changed"))}_setViews(e){e=Ul(e,Boolean),this._diffViews(e,this.views)&&this.setNeedsUpdate("views changed"),this.views=e}_setViewState(e){e?(!Me(e,this.viewState,3)&&this.setNeedsUpdate("viewState changed"),this.viewState=e):K.warn("missing `viewState` or `initialViewState`")()}_setEventManagers(e){this._eventManagers!==e&&(this._eventManagers=e,this.setNeedsUpdate("eventManagers changed"))}_getCanvasIdFromView(e){return e.props.canvasId||this._getCanvasContext?.(e.id)?.id||Gi}_getCanvasDimensions(e){const t=this._getCanvasContext?.(e.id),[n,s]=t?.getCSSSize()||[this.width,this.height];return{width:n,height:s}}_getViewEventManager(e){const t=this.getCanvasId(e)||Gi;return{canvasId:t,eventManager:this._eventManagers[t]||this._eventManager}}_startViewportRebuild(){const e=this.controllers,t=this._viewEventManagers;return this._viewports=[],this.controllers={},this._viewEventManagers={},{oldControllers:e,oldViewEventManagers:t}}_getReusableController(e,t,n){return e&&(t?.canvasId!==n.canvasId||t?.eventManager!==n.eventManager)?(e.finalize(),null):e}_createController(e,t){const n=t.type;return new n({timeline:this.timeline,eventManager:this._getViewEventManager(e).eventManager,onViewStateChange:this._eventCallbacks.onViewStateChange,onStateChange:this._eventCallbacks.onInteractionStateChange,makeViewport:r=>this.getView(e.id)?.makeViewport({viewState:r,...this._getCanvasDimensions(e)}),pickPosition:(r,o)=>this._pickPosition?.(r,o,e.id)})}_updateController(e,t,n,s){const r=e.controller;if(r&&n){const o={...t,...r,id:e.id,x:n.x,y:n.y,width:n.width,height:n.height};return(!s||s.constructor!==r.type)&&(s=this._createController(e,o)),s&&s.setProps(o),s}return null}_rebuildViewports(){const{views:e}=this,{oldControllers:t,oldViewEventManagers:n}=this._startViewportRebuild();let s=!1;for(let r=e.length;r--;){const o=e[r],{width:a,height:c}=this._getCanvasDimensions(o),l=this._getViewEventManager(o);this._viewEventManagers[o.id]=l;const u=this.getViewState(o),f=o.makeViewport({viewState:u,width:a,height:c});let d=this._getReusableController(t[o.id],n[o.id],l);const h=!!o.controller;h&&!d&&(s=!0),(s||!h)&&d&&(d.finalize(),d=null),this.controllers[o.id]=this._updateController(o,u,f,d),f&&this._viewports.unshift(f)}for(const r in t){const o=t[r];o&&!this.controllers[r]&&o.finalize()}this._buildViewportMap()}_buildViewportMap(){this._viewportMap={},this._viewports.forEach(e=>{e.id&&(this._viewportMap[e.id]=this._viewportMap[e.id]||e)})}_diffViews(e,t){return e.length!==t.length?!0:e.some((n,s)=>!e[s].equals(t[s]))}}const hL=/^(?:\d+\.?\d*|\.\d+)$/;function Ue(i){switch(typeof i){case"number":if(!Number.isFinite(i))throw new Error(`Could not parse position string ${i}`);return{type:"literal",value:i};case"string":try{const e=gL(i);return new pL(e).parseExpression()}catch(e){const t=e instanceof Error?e.message:String(e);throw new Error(`Could not parse position string ${i}: ${t}`)}default:throw new Error(`Could not parse position string ${i}`)}}function xc(i,e){switch(i.type){case"literal":return i.value;case"percentage":return Math.round(i.value*e);case"binary":const t=xc(i.left,e),n=xc(i.right,e);return i.operator==="+"?t+n:t-n;default:throw new Error("Unknown layout expression type")}}function $e(i,e){return xc(i,e)}function gL(i){const e=[];let t=0;for(;t<i.length;){const n=i[t];if(/\s/.test(n)){t++;continue}if(n==="+"||n==="-"||n==="("||n===")"||n==="%"){e.push({type:"symbol",value:n}),t++;continue}if(ld(n)||n==="."){const s=t;let r=n===".";for(t++;t<i.length;){const a=i[t];if(ld(a)){t++;continue}if(a==="."&&!r){r=!0,t++;continue}break}const o=i.slice(s,t);if(!hL.test(o))throw new Error("Invalid number token");e.push({type:"number",value:parseFloat(o)});continue}if(ud(n)){const s=t;for(;t<i.length&&ud(i[t]);)t++;const r=i.slice(s,t).toLowerCase();e.push({type:"word",value:r});continue}throw new Error("Invalid token in position string")}return e}class pL{constructor(e){this.index=0,this.tokens=e}parseExpression(){const e=this.parseBinaryExpression();if(this.index<this.tokens.length)throw new Error("Unexpected token at end of expression");return e}parseBinaryExpression(){let e=this.parseFactor(),t=this.peek();for(;mL(t);){this.index++;const n=this.parseFactor();e={type:"binary",operator:t.value,left:e,right:n},t=this.peek()}return e}parseFactor(){const e=this.peek();if(!e)throw new Error("Unexpected end of expression");if(e.type==="symbol"&&e.value==="+")return this.index++,this.parseFactor();if(e.type==="symbol"&&e.value==="-"){this.index++;const t=this.parseFactor();return{type:"binary",operator:"-",left:{type:"literal",value:0},right:t}}if(e.type==="symbol"&&e.value==="("){this.index++;const t=this.parseBinaryExpression();if(!this.consumeSymbol(")"))throw new Error("Missing closing parenthesis");return t}if(e.type==="word"&&e.value==="calc"){if(this.index++,!this.consumeSymbol("("))throw new Error("Missing opening parenthesis after calc");const t=this.parseBinaryExpression();if(!this.consumeSymbol(")"))throw new Error("Missing closing parenthesis");return t}if(e.type==="number"){this.index++;const t=e.value,n=this.peek();return n&&n.type==="symbol"&&n.value==="%"?(this.index++,{type:"percentage",value:t/100}):n&&n.type==="word"&&n.value==="px"?(this.index++,{type:"literal",value:t}):{type:"literal",value:t}}throw new Error("Unexpected token in expression")}consumeSymbol(e){const t=this.peek();return t&&t.type==="symbol"&&t.value===e?(this.index++,!0):!1}peek(){return this.tokens[this.index]||null}}function ld(i){return i>="0"&&i<="9"}function ud(i){return i>="a"&&i<="z"||i>="A"&&i<="Z"}function mL(i){return!!(i&&i.type==="symbol"&&(i.value==="+"||i.value==="-"))}function yL(i,e){const t={...i};for(const n in e)n!=="id"&&(Array.isArray(t[n])&&Array.isArray(e[n])?t[n]=_L(t[n],e[n]):t[n]=e[n]);return t}function _L(i,e){i=i.slice();for(let t=0;t<e.length;t++){const n=e[t];Number.isFinite(n)&&(i[t]=n)}return i}class di{constructor(e){const{id:t,x:n=0,y:s=0,width:r="100%",height:o="100%",padding:a=null}=e;this.id=t||this.constructor.displayName||"view",this.props={...e,id:this.id},this._x=Ue(n),this._y=Ue(s),this._width=Ue(r),this._height=Ue(o),this._padding=a&&{left:Ue(a.left||0),right:Ue(a.right||0),top:Ue(a.top||0),bottom:Ue(a.bottom||0)},this.equals=this.equals.bind(this),Object.seal(this)}equals(e){return this===e?!0:this.constructor===e.constructor&&Me(this.props,e.props,2)}clone(e){const t=this.constructor;return new t({...this.props,...e})}makeViewport({width:e,height:t,viewState:n}){n=this.filterViewState(n);const s=this.getDimensions({width:e,height:t});if(!s.height||!s.width)return null;const r=this.getViewportType(n);return new r({...n,...this.props,...s})}getViewStateId(){const{viewState:e}=this.props;return typeof e=="string"?e:e?.id||this.id}filterViewState(e){return this.props.viewState&&typeof this.props.viewState=="object"?this.props.viewState.id?yL(e,this.props.viewState):this.props.viewState:e}getDimensions({width:e,height:t}){const n={x:$e(this._x,e),y:$e(this._y,t),width:$e(this._width,e),height:$e(this._height,t)};return this._padding&&(n.padding={left:$e(this._padding.left,e),top:$e(this._padding.top,t),right:$e(this._padding.right,e),bottom:$e(this._padding.bottom,t)}),n}get controller(){const e=this.props.controller;return e?e===!0?{type:this.ControllerType}:typeof e=="function"?{type:e}:{type:this.ControllerType,...e}:null}}class no{constructor(e){this._inProgress=!1,this._handle=null,this.time=0,this.settings={duration:0},this._timeline=e}get inProgress(){return this._inProgress}start(e){this.cancel(),this.settings=e,this._inProgress=!0,this.settings.onStart?.(this)}end(){this._inProgress&&(this._timeline.removeChannel(this._handle),this._handle=null,this._inProgress=!1,this.settings.onEnd?.(this))}cancel(){this._inProgress&&(this.settings.onInterrupt?.(this),this._timeline.removeChannel(this._handle),this._handle=null,this._inProgress=!1)}update(){if(!this._inProgress)return!1;if(this._handle===null){const{_timeline:e,settings:t}=this;this._handle=e.addChannel({delay:e.getTime(),duration:t.duration})}return this.time=this._timeline.getTime(this._handle),this._onUpdate(),this.settings.onUpdate?.(this),this._timeline.isFinished(this._handle)&&this.end(),!0}_onUpdate(){}}const fd=()=>{},dd={mode:"preserve"},bL={mode:"hard"},wc={BREAK:1,SNAP_TO_END:2,IGNORE:3},vL=i=>i,xL=wc.BREAK;class wL{constructor(e){this._onTransitionUpdate=t=>{const{time:n,settings:{interpolator:s,startProps:r,endProps:o,duration:a,easing:c}}=t,l=c(n/a),u=s.interpolateProps(r,o,l);this.propsInTransition=this.getControllerState({...this.props,...u},dd).getViewportProps(),this.onViewStateChange({viewState:this.propsInTransition,oldViewState:this.props})},this.getControllerState=e.getControllerState,this.propsInTransition=null,this.transition=new no(e.timeline),this.onViewStateChange=e.onViewStateChange||fd,this.onStateChange=e.onStateChange||fd}finalize(){this.transition.cancel()}getViewportInTransition(){return this.propsInTransition}processViewStateChange(e){let t=!1;const n=this.props;if(this.props=e,!n||this._shouldIgnoreViewportChange(n,e))return!1;if(this._isTransitionEnabled(e)){let s=n;if(this.transition.inProgress){const{interruption:r,endProps:o}=this.transition.settings;s={...n,...r===wc.SNAP_TO_END?o:this.propsInTransition||n}}this._triggerTransition(s,e),t=!0}else this.transition.cancel();return t}updateTransition(){this.transition.update()}_isTransitionEnabled(e){const{transitionDuration:t,transitionInterpolator:n}=e;return(t>0||t==="auto")&&!!n}_isUpdateDueToCurrentTransition(e){return this.transition.inProgress&&this.propsInTransition?this.transition.settings.interpolator.arePropsEqual(e,this.propsInTransition):!1}_shouldIgnoreViewportChange(e,t){return this.transition.inProgress?this.transition.settings.interruption===wc.IGNORE||this._isUpdateDueToCurrentTransition(t):this._isTransitionEnabled(t)?t.transitionInterpolator.arePropsEqual(e,t):!0}_triggerTransition(e,t){const n=this.getControllerState(e,dd),s=this.getControllerState(t,bL).shortestPathFrom(n),r=t.transitionInterpolator,o=r.getDuration?r.getDuration(e,t):t.transitionDuration;if(o===0)return;const a=r.initializeProps(e,s);this.propsInTransition={};const c={duration:o,easing:t.transitionEasing||vL,interpolator:r,interruption:t.transitionInterruption||xL,startProps:a.start,endProps:a.end,onStart:t.onTransitionStart,onUpdate:this._onTransitionUpdate,onInterrupt:this._onTransitionEnd(t.onTransitionInterrupt),onEnd:this._onTransitionEnd(t.onTransitionEnd)};this.transition.start(c),this.onStateChange({inTransition:!0}),this.updateTransition()}_onTransitionEnd(e){return t=>{this.propsInTransition=null,this.onStateChange({inTransition:!1,isZooming:!1,isPanning:!1,isRotating:!1}),e?.(t)}}}function he(i,e){if(!i)throw new Error(e||"deck.gl: assertion failed.")}class $l{constructor(e){const{compare:t,extract:n,required:s}=e;this._propsToCompare=t,this._propsToExtract=n||t,this._requiredProps=s}arePropsEqual(e,t){for(const n of this._propsToCompare)if(!(n in e)||!(n in t)||!Ni(e[n],t[n]))return!1;return!0}initializeProps(e,t){const n={},s={};for(const r of this._propsToExtract)(r in e||r in t)&&(n[r]=e[r],s[r]=t[r]);return this._checkRequiredProps(n),this._checkRequiredProps(s),{start:n,end:s}}getDuration(e,t){return t.transitionDuration}_checkRequiredProps(e){this._requiredProps&&this._requiredProps.forEach(t=>{const n=e[t];he(Number.isFinite(n)||Array.isArray(n),`${t} is required for transition`)})}}const PL=["longitude","latitude","zoom","bearing","pitch"],SL=["longitude","latitude","zoom"];class Gl extends $l{constructor(e={}){const t=Array.isArray(e)?e:e.transitionProps,n=Array.isArray(e)?{}:e;n.transitionProps=Array.isArray(t)?{compare:t,required:t}:t||{compare:PL,required:SL},super(n.transitionProps),this.opts=n}initializeProps(e,t){const n=super.initializeProps(e,t),{makeViewport:s,around:r}=this.opts;if(s&&r){const o=s(e),a=s(t),c=o.unproject(r);n.start.around=r,Object.assign(n.end,{around:a.project(c),aroundPosition:c,width:t.width,height:t.height})}return n}interpolateProps(e,t,n){const s={};for(const r of this._propsToExtract)s[r]=Ut(e[r]||0,t[r]||0,n);if(t.aroundPosition&&this.opts.makeViewport){const r=this.opts.makeViewport({...t,...s});Object.assign(s,r.panByPosition(t.aroundPosition,Ut(e.around,t.around,n)))}return s}}const rt={transitionDuration:0},EL=300,CL=300,oa=i=>1-(1-i)*(1-i),LL=i=>i===1?1:1-Math.pow(2,-10*i),Yt={WHEEL:["wheel"],PAN:["panstart","panmove","panend"],PINCH:["pinchstart","pinchmove","pinchend"],MULTI_PAN:["multipanstart","multipanmove","multipanend"],DOUBLE_CLICK:["dblclick"],DOUBLE_CLICK_DRAG:["dblclickdragstart","dblclickdragmove","dblclickdragend","dblclickdragcancel"],KEYBOARD:["keydown"]},qt={};class im{constructor(e){this.state={},this._events={},this._interactionState={isDragging:!1},this._customEvents=[],this._eventStartBlocked=null,this._panMove=!1,this._multiPanMode=null,this._multiPanStartCenter=null,this._doubleClickDragAnchor=null,this._suppressDoubleClickUntil=0,this.invertPan=!1,this.dragMode="rotate",this.inertia=0,this.scrollZoom=!0,this.dragPan=!0,this.dragRotate=!0,this.doubleClickZoom=!0,this.doubleClickDragZoom=!0,this.touchZoom=!0,this.touchRotate=!1,this.multiTouchDrag=null,this.trackpadGesture=!1,this.zoomAround="pointer",this.keyboard=!0,this.transitionManager=new wL({...e,getControllerState:(t,n)=>new this.ControllerState({...t,constraintContext:n,makeViewport:e.makeViewport}),onViewStateChange:this._onTransition.bind(this),onStateChange:this._setInteractionState.bind(this)}),this.handleEvent=this.handleEvent.bind(this),this.eventManager=e.eventManager,this.onViewStateChange=e.onViewStateChange||(()=>{}),this.onStateChange=e.onStateChange||(()=>{}),this.makeViewport=e.makeViewport,this.pickPosition=e.pickPosition}set events(e){this.toggleEvents(this._customEvents,!1),this.toggleEvents(e,!0),this._customEvents=e,this.props&&this.setProps(this.props)}finalize(){for(const e in this._events)this._events[e]&&this.eventManager?.off(e,this.handleEvent);this.transitionManager.finalize()}handleEvent(e){this._controllerState=void 0;const t=this._eventStartBlocked;switch(e.type){case"panstart":return t?!1:this._onPanStart(e);case"panmove":return this._onPan(e);case"panend":return this._onPanEnd(e);case"pinchstart":return t||!this._isTrackpadGestureAllowed(e)?!1:this._onPinchStart(e);case"pinchmove":return this._isTrackpadGestureAllowed(e)?this._onPinch(e):!1;case"pinchend":return this._isTrackpadGestureAllowed(e)?this._onPinchEnd(e):!1;case"multipanstart":return t?!1:this._onMultiPanStart(e);case"multipanmove":return this._onMultiPan(e);case"multipanend":return this._onMultiPanEnd(e);case"dblclick":return this._onDoubleClick(e);case"dblclickdragstart":return t?!1:this._onDoubleClickDragStart(e);case"dblclickdragmove":return this._onDoubleClickDrag(e);case"dblclickdragend":case"dblclickdragcancel":return this._onDoubleClickDragEnd(e);case"wheel":return this._onWheel(e);case"keydown":return this._onKeyDown(e);default:return!1}}get controllerState(){return this._controllerState=this._controllerState||new this.ControllerState({makeViewport:this.makeViewport,...this.props,...this.state}),this._controllerState}getCenter(e){const{x:t,y:n}=this.props,{offsetCenter:s}=e;return[s.x-t,s.y-n]}getZoomPosition(e){if(this.zoomAround==="pointer")return e;const t=this.makeViewport(this.controllerState.getViewportProps()),[n,s]=Ol(t.center,t.pixelProjectionMatrix);return[n,s]}isPointInBounds(e,t){const{width:n,height:s}=this.props;if(t&&t.handled)return!1;const r=e[0]>=0&&e[0]<=n&&e[1]>=0&&e[1]<=s;return r&&t&&t.stopPropagation(),r}isFunctionKeyPressed(e){const{srcEvent:t}=e;return!!(t.metaKey||t.altKey||t.ctrlKey||t.shiftKey)}isDragging(){return this._interactionState.isDragging||!1}blockEvents(e){const t=setTimeout(()=>{this._eventStartBlocked===t&&(this._eventStartBlocked=null)},e);this._eventStartBlocked=t}setProps(e){e.maxBoundsPadding===void 0&&(e.maxBoundsPadding=null),e.dragMode&&(this.dragMode=e.dragMode);const t=this.props;this.props=e,"transitionInterpolator"in e||(e.transitionInterpolator=this._getTransitionProps().transitionInterpolator),this.transitionManager.processViewStateChange(e);const{inertia:n}=e;this.inertia=Number.isFinite(n)?n:n===!0?EL:0;const{scrollZoom:s=!0,dragPan:r=!0,dragRotate:o=!0,doubleClickZoom:a=!0,doubleClickDragZoom:c=!1,touchZoom:l=!0,touchRotate:u=!1,multiTouchDrag:f=u?"rotate":null,trackpadGesture:d=!1,zoomAround:h="pointer",keyboard:g=!0}=e,p=!!this.onViewStateChange;if(this.toggleEvents(Yt.WHEEL,p&&s),this.toggleEvents(Yt.PAN,p),this.toggleEvents(Yt.PINCH,p&&(l||f==="rotate")),this.toggleEvents(Yt.MULTI_PAN,p&&!!f),this.toggleEvents(Yt.DOUBLE_CLICK,p&&a),this.toggleEvents(Yt.DOUBLE_CLICK_DRAG,p&&c),this.toggleEvents(Yt.KEYBOARD,p&&g),this.scrollZoom=s,this.dragPan=r,this.dragRotate=o,this.doubleClickZoom=a,this.doubleClickDragZoom=c,this.touchZoom=l,this.touchRotate=f==="rotate",this.multiTouchDrag=f,this.trackpadGesture=d,this.zoomAround=h,this.keyboard=g,(!t||t.height!==e.height||t.width!==e.width||t.maxBounds!==e.maxBounds||t.maxBoundsPadding!==e.maxBoundsPadding)&&e.maxBounds){const _=new this.ControllerState({...e,makeViewport:this.makeViewport}),v=_.getViewportProps();Object.keys(v).some(x=>!Me(v[x],e[x],1))&&this.updateViewport(_)}}updateTransition(){this.transitionManager.updateTransition()}toggleEvents(e,t){this.eventManager&&e.forEach(n=>{this._events[n]!==t&&(this._events[n]=t,t?this.eventManager.on(n,this.handleEvent):this.eventManager.off(n,this.handleEvent))})}updateViewport(e,t=null,n={}){const s={...e.getViewportProps(),...t},r=this.controllerState!==e;if(this.state=e.getState(),this._setInteractionState(n),r){const o=this.controllerState&&this.controllerState.getViewportProps();this.onViewStateChange&&this.onViewStateChange({viewState:s,interactionState:this._interactionState,oldViewState:o,viewId:this.props.id})}}_onTransition(e){this.onViewStateChange({...e,interactionState:this._interactionState,viewId:this.props.id})}_setInteractionState(e){Object.assign(this._interactionState,e),this.onStateChange(this._interactionState)}_getConstraintContext(e,t){return this.props.rubberBand?{mode:t==="update"?"elastic":t==="end"?"rebound":"hard"}:{mode:"hard"}}_getReboundTransition(e,t){if(e.mode!=="rebound")return null;const n=t.getViewportProps();return Object.keys(n).some(r=>!Me(this.props[r],n[r],1))?{...this._getTransitionProps(),transitionDuration:CL,transitionEasing:LL}:null}_onPanStart(e){const t=this.getCenter(e);if(!this.isPointInBounds(t,e))return!1;let n=this.isFunctionKeyPressed(e)||e.rightButton||!1;(this.invertPan||this.dragMode==="pan")&&(n=!n);const s=n?"pan":"rotate",r=this._getConstraintContext(s,"start"),o=n?this.controllerState.panStart({pos:t},r):this.controllerState.rotateStart({pos:t},r);return this._panMove=n,this.updateViewport(o,rt,{isDragging:!0}),!0}_onPan(e){return this.isDragging()?this._panMove?this._onPanMove(e):this._onPanRotate(e):!1}_onPanEnd(e){return this.isDragging()?this._panMove?this._onPanMoveEnd(e):this._onPanRotateEnd(e):!1}_onPanMove(e){if(!this.dragPan)return!1;const t=this.getCenter(e),n=this.controllerState.pan({pos:t},this._getConstraintContext("pan","update"));return this.updateViewport(n,rt,{isDragging:!0,isPanning:!0}),!0}_onPanMoveEnd(e){const{inertia:t}=this;if(this.dragPan&&t&&e.velocity){const n=this.getCenter(e),s=[n[0]+e.velocityX*t/2,n[1]+e.velocityY*t/2],r=this.controllerState.pan({pos:s}).panEnd();this.updateViewport(r,{...this._getTransitionProps(),transitionDuration:t,transitionEasing:oa},{isDragging:!1,isPanning:!0})}else{const n=this.controllerState,s=this._getConstraintContext("pan","end"),r=n.panEnd(s),o=this._getReboundTransition(s,r);this.updateViewport(r,o,{isDragging:!1,isPanning:!!o})}return!0}_onPanRotate(e){if(!this.dragRotate)return!1;const t=this.getCenter(e),n=this.controllerState.rotate({pos:t},this._getConstraintContext("rotate","update"));return this.updateViewport(n,rt,{isDragging:!0,isRotating:!0}),!0}_onPanRotateEnd(e){const{inertia:t}=this;if(this.dragRotate&&t&&e.velocity){const n=this.getCenter(e),s=[n[0]+e.velocityX*t/2,n[1]+e.velocityY*t/2],r=this.controllerState.rotate({pos:s}).rotateEnd();this.updateViewport(r,{...this._getTransitionProps(),transitionDuration:t,transitionEasing:oa},{isDragging:!1,isRotating:!0})}else{const n=this.controllerState,s=this._getConstraintContext("rotate","end"),r=n.rotateEnd(s),o=this._getReboundTransition(s,r);this.updateViewport(r,o,{isDragging:!1,isRotating:!!o})}return!0}_onWheel(e){if(!this.scrollZoom||this.trackpadGesture&&e.device!=="mouse")return!1;const t=this.getCenter(e);if(!this.isPointInBounds(t,e))return!1;e.srcEvent.preventDefault();const{speed:n=.01,smooth:s=!1}=this.scrollZoom===!0?{}:this.scrollZoom,{delta:r}=e;let o=2/(1+Math.exp(-Math.abs(r*n)));r<0&&o!==0&&(o=1/o);const a=this.getZoomPosition(t),c=s?{...this._getTransitionProps({around:a}),transitionDuration:250}:rt,l=this.controllerState.zoom({pos:a,scale:o});return this.updateViewport(l,c,{isZooming:!0,isPanning:!0}),s||this._setInteractionState({isZooming:!1,isPanning:!1}),!0}_onMultiPanStart(e){const{multiTouchDrag:t}=this;if(!t||!this._isMultiPanEventAllowed(e,t))return!1;const n=e.offsetCenter;if(!this.isPointInBounds(this.getCenter(e),e))return!1;const s=e.pointerType==="trackpad",r={x:n.x-(s?0:e.deltaX),y:n.y-(s?0:e.deltaY)},o={...e,offsetCenter:r},a=this.getCenter(o),c=t==="pan"?this.controllerState.panStart({pos:a},this._getConstraintContext("pan","start")):this.controllerState.rotateStart({pos:a},this._getConstraintContext("rotate","start"));return this._multiPanMode=t,this._multiPanStartCenter=r,this.updateViewport(c,rt,{isDragging:!0}),!0}_onMultiPan(e){const{mode:t,event:n}=this._getMultiPanEvent(e);return!t||!n||!this.isDragging()?!1:t==="pan"?this._onPanMove(n):this._onPanRotate(n)}_onMultiPanEnd(e){const{mode:t,event:n}=this._getMultiPanEvent(e);if(!t||!n||!this.isDragging())return this._resetMultiPan(),!1;const s=t==="pan"?this._onPanMoveEnd(n):this._onPanRotateEnd(n);return this._resetMultiPan(),s}_isTrackpadGestureAllowed(e){return e.pointerType!=="trackpad"||this.trackpadGesture}_isMultiPanEventAllowed(e,t){return e.pointerType==="trackpad"?this.trackpadGesture&&(t==="pan"?this.dragPan:this.dragRotate):e.pointerType==="touch"&&(t==="pan"?this.dragPan:this.dragRotate)}_getMultiPanEvent(e){const t=this._multiPanMode,n=this._multiPanStartCenter;return!t||!n?{mode:null,event:null}:{mode:t,event:{...e,offsetCenter:{x:n.x+e.deltaX,y:n.y+e.deltaY}}}}_resetMultiPan(){this._multiPanMode=null,this._multiPanStartCenter=null}_onPinchStart(e){this._doubleClickDragAnchor=null;const t=this.getCenter(e);if(!this.isPointInBounds(t,e))return!1;const n=this.controllerState.zoomStart({pos:this.getZoomPosition(t)},this._getConstraintContext("zoom","start")).rotateStart({pos:t},this._getConstraintContext("rotate","start"));return qt._startPinchRotation=e.rotation,qt._lastPinchEvent=e,this.updateViewport(n,rt,{isDragging:!0}),!0}_onPinch(e){if(!this.touchZoom&&!this.touchRotate||!this.isDragging())return!1;let t=this.controllerState;if(this.touchZoom){const{scale:n}=e,s=this.getCenter(e);t=t.zoom({pos:this.getZoomPosition(s),scale:n},this._getConstraintContext("zoom","update"))}if(this.touchRotate){const{rotation:n}=e;t=t.rotate({deltaAngleX:qt._startPinchRotation-n},this._getConstraintContext("rotate","update"))}return this.updateViewport(t,rt,{isDragging:!0,isPanning:this.touchZoom,isZooming:this.touchZoom,isRotating:this.touchRotate}),qt._lastPinchEvent=e,!0}_onPinchEnd(e){if(!this.isDragging())return!1;const{inertia:t}=this,{_lastPinchEvent:n}=qt;if(this.touchZoom&&t&&n&&e.scale!==n.scale){const s=this.getCenter(e),r=this.getZoomPosition(s);let o=this.controllerState.rotateEnd();const a=Math.log2(e.scale),c=(a-Math.log2(n.scale))/(e.deltaTime-n.deltaTime),l=Math.pow(2,a+c*t/2);o=o.zoom({pos:r,scale:l}).zoomEnd(),this.updateViewport(o,{...this._getTransitionProps({around:r}),transitionDuration:t,transitionEasing:oa},{isDragging:!1,isPanning:this.touchZoom,isZooming:this.touchZoom,isRotating:!1}),this.blockEvents(t)}else{const s=this.controllerState,r=this._getConstraintContext("zoom","end"),o=this._getConstraintContext("rotate","end"),a=s.zoomEnd(r).rotateEnd(o),c=this._getReboundTransition(this.touchZoom?r:o,a);this.updateViewport(a,c,{isDragging:!1,isPanning:!!c&&this.touchZoom,isZooming:!!c&&this.touchZoom,isRotating:!!c&&this.touchRotate})}return qt._startPinchRotation=null,qt._lastPinchEvent=null,!0}_onDoubleClick(e){if(!this.doubleClickZoom||Date.now()<this._suppressDoubleClickUntil)return!1;const t=this.getCenter(e);if(!this.isPointInBounds(t,e))return!1;const n=this.isFunctionKeyPressed(e),s=this.getZoomPosition(t),r=this.controllerState.zoom({pos:s,scale:n?.5:2});return this.updateViewport(r,this._getTransitionProps({around:s}),{isZooming:!0,isPanning:!0}),this.blockEvents(100),!0}_onDoubleClickDragStart(e){if(!this.doubleClickDragZoom)return this._doubleClickDragAnchor=null,!1;const t=this.getCenter(e);if(!this.isPointInBounds(t,e))return this._doubleClickDragAnchor=null,!1;this._doubleClickDragAnchor=this.getZoomPosition(t);let n=this.controllerState.zoomStart({pos:this._doubleClickDragAnchor},this._getConstraintContext("zoom","start"));return e.scale!==1&&(n=n.zoom({pos:this._doubleClickDragAnchor,scale:e.scale},this._getConstraintContext("zoom","update"))),this.updateViewport(n,rt,{isDragging:!0,isPanning:!0,isZooming:!0}),!0}_onDoubleClickDrag(e){const t=this._doubleClickDragAnchor;if(!t)return!1;const n=this.controllerState.zoom({pos:t,scale:e.scale},this._getConstraintContext("zoom","update"));return this.updateViewport(n,rt,{isDragging:!0,isPanning:!0,isZooming:!0}),!0}_onDoubleClickDragEnd(e){if(!this._doubleClickDragAnchor)return!1;this._doubleClickDragAnchor=null;const n=this.controllerState,s=this._getConstraintContext("zoom","end"),r=n.zoomEnd(s),o=this._getReboundTransition(s,r);return this.updateViewport(r,o,{isDragging:!1,isPanning:!!o,isZooming:!!o}),this._suppressDoubleClickUntil=Date.now()+100,this.blockEvents(100),!0}_onKeyDown(e){if(!this.keyboard)return!1;const t=this.isFunctionKeyPressed(e),{zoomSpeed:n,moveSpeed:s,rotateSpeedX:r,rotateSpeedY:o}=this.keyboard===!0?{}:this.keyboard,{controllerState:a}=this;let c;const l={};switch(e.srcEvent.code){case"Minus":c=t?a.zoomOut(n).zoomOut(n):a.zoomOut(n),l.isZooming=!0;break;case"Equal":c=t?a.zoomIn(n).zoomIn(n):a.zoomIn(n),l.isZooming=!0;break;case"ArrowLeft":t?(c=a.rotateLeft(r),l.isRotating=!0):(c=a.moveLeft(s),l.isPanning=!0);break;case"ArrowRight":t?(c=a.rotateRight(r),l.isRotating=!0):(c=a.moveRight(s),l.isPanning=!0);break;case"ArrowUp":t?(c=a.rotateUp(o),l.isRotating=!0):(c=a.moveUp(s),l.isPanning=!0);break;case"ArrowDown":t?(c=a.rotateDown(o),l.isRotating=!0):(c=a.moveDown(s),l.isPanning=!0);break;default:return!1}return this.updateViewport(c,this._getTransitionProps(),l),!0}_getTransitionProps(e){const{transition:t}=this;return!t||!t.transitionInterpolator?rt:e?{...t,transitionInterpolator:new Gl({...e,...t.transitionInterpolator.opts,makeViewport:this.controllerState.makeViewport})}:t}}const ei=Symbol("constraintAround");class TL{constructor(e,t,n,s){this.makeViewport=n,this._viewportProps=this.applyConstraints(e,s),this._state=t}getViewportProps(){return this._viewportProps}getState(){return this._state}}function aa(i,e,t){const n=i-e;return n&&Number.isFinite(n)?e+n*t/(t+Math.abs(n)):e}function Rr(i,e,t){const n=$e(Ue(t?.left??0),i),s=$e(Ue(t?.right??0),i),r=$e(Ue(t?.top??0),e),o=$e(Ue(t?.bottom??0),e);return{x:n,y:r,width:i-n-s,height:e-r-o}}function nm(i,e,t){let[n,s]=i.project(e);return n=Number.isFinite(n)?n:i.width/2,s=Number.isFinite(s)?s:i.height/2,{left:n-t.x,right:t.x+t.width-n,top:s-t.y,bottom:t.y+t.height-s}}const hd=5,AL=1.2,gd=512,sm=[[-1/0,-90],[1/0,90]],ML=1;function dn([i,e]){if(Math.abs(e)>90&&(e=Math.sign(e)*90),Number.isFinite(i)){const[n,s]=bt([i,e]);return[n,me(s,0,gd)]}const[,t]=bt([0,e]);return[i,me(t,0,gd)]}class rm extends TL{constructor(e){const{width:t,height:n,latitude:s,longitude:r,zoom:o,bearing:a=0,pitch:c=0,altitude:l=1.5,position:u=[0,0,0],maxZoom:f=20,minZoom:d=0,maxPitch:h=60,minPitch:g=0,startPanLngLat:p,startZoomLngLat:m,startRotatePos:_,startRotateLngLat:v,startBearing:b,startPitch:x,startZoom:w,normalize:C=!0,rubberBand:B=!1}=e,{[ei]:F}=e;he(Number.isFinite(r)),he(Number.isFinite(s)),he(Number.isFinite(o));const D=e.maxBounds||(C?sm:null),k=e.maxBoundsPadding||null;super({width:t,height:n,latitude:s,longitude:r,zoom:o,bearing:a,pitch:c,altitude:l,maxZoom:f,minZoom:d,maxPitch:h,minPitch:g,normalize:C,position:u,maxBounds:D,maxBoundsPadding:k,rubberBand:B,[ei]:F},{startPanLngLat:p,startZoomLngLat:m,startRotatePos:_,startRotateLngLat:v,startBearing:b,startPitch:x,startZoom:w},e.makeViewport,e.constraintContext),this.getAltitude=e.getAltitude}panStart({pos:e},t){return this._getUpdatedState({startPanLngLat:this._unproject(e)},t)}pan({pos:e,startPos:t},n){const s=this.getState().startPanLngLat||this._unproject(t);if(!s)return this;const o=this.makeViewport(this.getViewportProps()).panByPosition(s,e);return this._getUpdatedState(o,n)}panEnd(e){return this._getUpdatedState({startPanLngLat:null},e)}rotateStart({pos:e}){const t=this.getAltitude?.(e);return this._getUpdatedState({startRotatePos:e,startRotateLngLat:t!==void 0?this._unproject3D(e,t):void 0,startBearing:this.getViewportProps().bearing,startPitch:this.getViewportProps().pitch})}rotate({pos:e,deltaAngleX:t=0,deltaAngleY:n=0}){const{startRotatePos:s,startRotateLngLat:r,startBearing:o,startPitch:a}=this.getState();if(!s||o===void 0||a===void 0)return this;let c;if(e?c=this._getNewRotation(e,s,a,o):c={bearing:o+t,pitch:a+n},r){const l=this.makeViewport({...this.getViewportProps(),...c}),u="panByPosition3D"in l?"panByPosition3D":"panByPosition";return this._getUpdatedState({...c,...l[u](r,s)})}return this._getUpdatedState(c)}rotateEnd(){return this._getUpdatedState({startRotatePos:null,startRotateLngLat:null,startBearing:null,startPitch:null})}zoomStart({pos:e},t){return this._getUpdatedState({startZoomLngLat:this._unproject(e),startZoom:this.getViewportProps().zoom},t)}zoom({pos:e,startPos:t,scale:n},s){let{startZoom:r,startZoomLngLat:o}=this.getState();return o||(r=this.getViewportProps().zoom,o=this._unproject(t)||this._unproject(e)),o?this._getUpdatedState({zoom:r+Math.log2(n),[ei]:{position:o,screenPosition:e}},s):this}zoomEnd(e){return this._getUpdatedState({startZoomLngLat:null,startZoom:null},e)}zoomIn(e=2,t){return this._zoomFromCenter(e,t)}zoomOut(e=2,t){return this._zoomFromCenter(1/e,t)}moveLeft(e=100,t){return this._panFromCenter([e,0],t)}moveRight(e=100,t){return this._panFromCenter([-e,0],t)}moveUp(e=100,t){return this._panFromCenter([0,e],t)}moveDown(e=100,t){return this._panFromCenter([0,-e],t)}rotateLeft(e=15){return this._getUpdatedState({bearing:this.getViewportProps().bearing-e})}rotateRight(e=15){return this._getUpdatedState({bearing:this.getViewportProps().bearing+e})}rotateUp(e=10){return this._getUpdatedState({pitch:this.getViewportProps().pitch+e})}rotateDown(e=10){return this._getUpdatedState({pitch:this.getViewportProps().pitch-e})}shortestPathFrom(e){const t=e.getViewportProps(),n={...this.getViewportProps()},{bearing:s,longitude:r}=n;return Math.abs(s-t.bearing)>180&&(n.bearing=s<0?s+360:s-360),Math.abs(r-t.longitude)>180&&(n.longitude=r<0?r+360:r-360),n}applyConstraints(e,t){const n=e,s=n[ei];delete n[ei];const{maxPitch:r,minPitch:o,pitch:a,bearing:c,normalize:l,maxBounds:u,rubberBand:f}=e;l&&(c<-180||c>180)&&(e.bearing=Xi(c+180,360)-180),e.pitch=me(a,o,r);const d=this._constrainZoom(e.zoom,e),h=f&&t?.mode==="elastic";if(e.zoom=t?.mode==="preserve"?e.zoom:h?aa(e.zoom,d,ML):d,s){const g=this.makeViewport(e);Object.assign(e,g.panByPosition(s.position,s.screenPosition))}if(l&&(e.longitude<-180||e.longitude>180)&&(e.longitude=Xi(e.longitude+180,360)-180),u){const g=Rr(e.width,e.height,e.maxBoundsPadding),p=this.makeViewport({...e,bearing:0,pitch:0}),m=nm(p,[e.longitude,e.latitude],g),_=dn(u[0]),v=dn(u[1]),b=2**e.zoom,x=[_[0]+m.left/b,_[1]+m.bottom/b],w=[v[0]-m.right/b,v[1]-m.top/b],C=dn([e.longitude,e.latitude]),B=[me(C[0],x[0],w[0]),me(C[1],x[1],w[1])],F=C.slice();if(g.width>=0&&(F[0]=t?.mode==="preserve"?C[0]:h?aa(C[0],B[0],g.width/2/b):B[0]),g.height>=0&&(F[1]=t?.mode==="preserve"?C[1]:h?aa(C[1],B[1],g.height/2/b):B[1]),F[0]!==C[0]||F[1]!==C[1]){const[D,k]=on(F);F[0]!==C[0]&&(e.longitude=D),F[1]!==C[1]&&(e.latitude=k)}}return e}_constrainZoom(e,t){t||(t=this.getViewportProps());const{maxZoom:n,maxBounds:s}=t,r=s!==null&&t.width>0&&t.height>0;let{minZoom:o}=t;if(r){const a=Rr(t.width,t.height,t.maxBoundsPadding),c=dn(s[0]),l=dn(s[1]),u=l[0]-c[0],f=l[1]-c[1];a.width>0&&Number.isFinite(u)&&u>0&&(o=Math.max(o,Math.log2(a.width/u))),a.height>0&&Number.isFinite(f)&&f>0&&(o=Math.max(o,Math.log2(a.height/f))),o>n&&(o=n)}return me(e,o,n)}_zoomFromCenter(e,t){const{width:n,height:s}=this.getViewportProps();return this.zoom({pos:[n/2,s/2],scale:e},t)}_panFromCenter(e,t){const{width:n,height:s}=this.getViewportProps();return this.pan({startPos:[n/2,s/2],pos:[n/2+e[0],s/2+e[1]]},t)}_getUpdatedState(e,t){return new this.constructor({makeViewport:this.makeViewport,...this.getViewportProps(),...this.getState(),...e,constraintContext:t})}_unproject(e){const t=this.makeViewport(this.getViewportProps());return e&&t.unproject(e)}_unproject3D(e,t){return this.makeViewport(this.getViewportProps()).unproject(e,{targetZ:t})}_getNewRotation(e,t,n,s){const r=e[0]-t[0],o=e[1]-t[1],a=e[1],c=t[1],{width:l,height:u}=this.getViewportProps(),f=r/l;let d=0;o>0?Math.abs(u-c)>hd&&(d=o/(c-u)*AL):o<0&&c>hd&&(d=1-a/c),d=me(d,-1,1);const{minPitch:h,maxPitch:g}=this.getViewportProps(),p=s+180*f;let m=n;return d>0?m=n+d*(g-n):d<0&&(m=n-d*(h-n)),{pitch:m,bearing:p}}}class IL extends im{constructor(){super(...arguments),this.ControllerState=rm,this.transition={transitionDuration:300,transitionInterpolator:new Gl({transitionProps:{compare:["longitude","latitude","zoom","bearing","pitch","position"],required:["longitude","latitude","zoom"]}})},this.dragMode="pan",this.rotationPivot="center",this._getAltitude=e=>{if(this.rotationPivot==="2d")return 0;if(this.rotationPivot==="3d"&&this.pickPosition){const{x:t,y:n}=this.props,s=this.pickPosition(t+e[0],n+e[1]);if(s&&s.coordinate&&s.coordinate.length>=3)return s.coordinate[2]}}}setProps(e){"rotationPivot"in e&&(this.rotationPivot=e.rotationPivot||"center"),e.getAltitude=this._getAltitude,e.position=e.position||[0,0,0],e.maxBounds=e.maxBounds||(e.normalize===!1?null:sm),super.setProps(e)}updateViewport(e,t=null,n={}){const s=e.getState();n.isDragging&&s.startRotateLngLat?n={...n,rotationPivotPosition:s.startRotateLngLat}:n.isDragging===!1&&(n={...n,rotationPivotPosition:void 0}),super.updateViewport(e,t,n)}}class om extends di{constructor(e={}){super(e)}getViewportType(){return St}get ControllerType(){return IL}}om.displayName="MapView";const RL=new qp;function OL(i,e){const t=i.order??1/0,n=e.order??1/0;return t-n}class kL{constructor(e){this._resolvedEffects=[],this._defaultEffects=[],this.effects=[],this._context=e,this._needsRedraw="Initial render",this._setEffects([])}addDefaultEffect(e){const t=this._defaultEffects;if(!t.find(n=>n.id===e.id)){const n=t.findIndex(s=>OL(s,e)>0);n<0?t.push(e):t.splice(n,0,e),e.setup(this._context),this._setEffects(this.effects)}}setProps(e){"effects"in e&&(Me(e.effects,this.effects,1)||this._setEffects(e.effects))}needsRedraw(e={clearRedrawFlags:!1}){const t=this._needsRedraw;return e.clearRedrawFlags&&(this._needsRedraw=!1),t}getEffects(){return this._resolvedEffects}_setEffects(e){const t={};for(const s of this.effects)t[s.id]=s;const n=[];for(const s of e){const r=t[s.id];let o=s;r&&r!==s?r.setProps?(r.setProps(s.props),o=r):r.cleanup(this._context):r||s.setup(this._context),n.push(o),delete t[s.id]}for(const s in t)t[s].cleanup(this._context);this.effects=n,this._resolvedEffects=n.concat(this._defaultEffects),e.some(s=>s instanceof qp)||this._resolvedEffects.push(RL),this._needsRedraw="effects changed"}finalize(){for(const e of this._resolvedEffects)e.cleanup(this._context);this.effects.length=0,this._resolvedEffects.length=0,this._defaultEffects.length=0}}class BL extends Bl{shouldDrawLayer(e){const{operation:t}=e.props;return t.includes("draw")||t.includes("terrain")}render(e){return this._render(e)}}const DL="deckRenderer.renderLayers";class FL{constructor(e,t={}){this.device=e,this.stats=t.stats,this.layerFilter=null,this.drawPickingColors=!1,this.drawLayersPass=new BL(e),this.pickLayersPass=new em(e),this.renderCount=0,this._needsRedraw="Initial render",this.renderBuffers=[],this.lastPostProcessEffect=null}setProps(e){this.layerFilter!==e.layerFilter&&(this.layerFilter=e.layerFilter,this._needsRedraw="layerFilter changed"),this.drawPickingColors!==e.drawPickingColors&&(this.drawPickingColors=e.drawPickingColors,this._needsRedraw="drawPickingColors changed")}renderLayers(e){const t=this.drawPickingColors?this.pickLayersPass:this.drawLayersPass,n={layerFilter:this.layerFilter,isPicking:this.drawPickingColors,...e};if(!e.viewports.length){const a=t.render(n),c="stats"in a?a.stats:a;this._updateStats(c);return}n.effects&&this._preRender(n.effects,n);const s=this.lastPostProcessEffect?this.renderBuffers[0]:n.target;this.lastPostProcessEffect&&(n.clearColor=[0,0,0,0],n.clearCanvas=!0);const r=t.render({...n,target:s}),o="stats"in r?r.stats:r;n.effects&&(this.lastPostProcessEffect&&(n.clearCanvas=e.clearCanvas===void 0?!0:e.clearCanvas),this._postRender(n.effects,n)),this.renderCount++,Se(DL,this,o,e),this._updateStats(o)}needsRedraw(e={clearRedrawFlags:!1}){const t=this._needsRedraw;return e.clearRedrawFlags&&(this._needsRedraw=!1),t}finalize(){const{renderBuffers:e}=this;for(const t of e)t.delete();e.length=0}_updateStats(e){if(!this.stats)return;let t=0;for(const{visibleCount:n}of e)t+=n;this.stats.get("Layers rendered").addCount(t)}_preRender(e,t){this.lastPostProcessEffect=null,t.preRenderStats=t.preRenderStats||{};for(const n of e)t.preRenderStats[n.id]=n.preRender(t),n.postRender&&(this.lastPostProcessEffect=n.id);this.lastPostProcessEffect&&this._resizeRenderBuffers(t.canvasContext)}_resizeRenderBuffers(e=this.device.canvasContext){const{renderBuffers:t}=this,n=e.getDrawingBufferSize(),[s,r]=n;t.length===0&&[0,1].map(o=>{const a=this.device.createTexture({sampler:{minFilter:"linear",magFilter:"linear"},width:s,height:r});t.push(this.device.createFramebuffer({id:`deck-renderbuffer-${o}`,colorAttachments:[a]}))});for(const o of t)o.resize(n)}_postRender(e,t){const{renderBuffers:n}=this,s=t.target??t.canvasContext?.getCurrentFramebuffer()??t.target,r={...t,inputBuffer:n[0],swapBuffer:n[1]};for(const o of e)if(o.postRender){r.target=o.id===this.lastPostProcessEffect?s:void 0;const a=o.postRender(r);r.inputBuffer=a,r.swapBuffer=a===n[0]?n[1]:n[0]}}}const zL={pickedColor:null,pickedObjectIndex:-1};function pd({pickedColors:i,decodePickingColor:e,deviceX:t,deviceY:n,deviceRadius:s,deviceRect:r}){const{x:o,y:a,width:c,height:l}=r;let u=s*s,f=-1,d=0;for(let h=0;h<l;h++){const g=h+a-n,p=g*g;if(p>u)d+=4*c;else for(let m=0;m<c;m++){if(i[d+3]-1>=0){const v=m+o-t,b=v*v+p;b<=u&&(u=b,f=d)}d+=4}}if(f>=0){const h=i.slice(f,f+4),g=e(h);if(g){const p=Math.floor(f/4/c),m=f/4-p*c;return{...g,pickedColor:h,pickedX:o+m,pickedY:a+p}}K.error("Picked non-existent layer. Is picking buffer corrupt?")()}return zL}function md({pickedColors:i,decodePickingColor:e}){const t=new Map;if(i){for(let n=0;n<i.length;n+=4)if(i[n+3]-1>=0){const r=i.slice(n,n+4),o=r.join(",");if(!t.has(o)){const a=e(r);a?t.set(o,{...a,color:r}):K.error("Picked non-existent layer. Is picking buffer corrupt?")()}}}return Array.from(t.values())}function Pc({pickInfo:i,viewports:e,pixelRatio:t,x:n,y:s,z:r}){let o=e[0];e.length>1&&(o=NL(i?.pickedViewports||e,{x:n,y:s}));let a;if(o){const c=[n-o.x,s-o.y];r!==void 0&&(c[2]=r),a=o.unproject(c)}return{color:null,layer:null,viewport:o,index:-1,picked:!1,x:n,y:s,pixel:[n,s],coordinate:a,devicePixel:i&&"pickedX"in i?[i.pickedX,i.pickedY]:void 0,pixelRatio:t}}function yd(i){const{pickInfo:e,lastPickedInfo:t,mode:n,layers:s}=i,{pickedColor:r,pickedLayer:o,pickedObjectIndex:a}=e,c=o?[o]:[];if(n==="hover"){const f=t.index,d=t.layerId,h=o?o.props.id:null;if(h!==d||a!==f){if(h!==d){const g=s.find(p=>p.props.id===d);g&&c.unshift(g)}t.layerId=h,t.index=a,t.info=null}}const l=Pc(i),u=new Map;return u.set(null,l),c.forEach(f=>{let d={...l};f===o&&(d.color=r,d.index=a,d.picked=!0),d=Sc({layer:f,info:d,mode:n});const h=d.layer;f===o&&n==="hover"&&(t.info=d),u.set(h.id,d),n==="hover"&&h.updateAutoHighlight(d)}),u}function Sc({layer:i,info:e,mode:t}){for(;i&&e;){const n=e.layer||null;e.sourceLayer=n,e.layer=i,e=i.getPickingInfo({info:e,mode:t,sourceLayer:n}),i=i.parent}return e}function NL(i,e){for(let t=i.length-1;t>=0;t--){const n=i[t];if(n.containsPixel(e))return n}return i[0]}class UL{constructor(e,t={}){this._pickable=!0,this.device=e,this.stats=t.stats,this.pickLayersPass=new em(e),this.lastPickedInfo={index:-1,layerId:null,info:null}}setProps(e){"layerFilter"in e&&(this.layerFilter=e.layerFilter),"_pickable"in e&&(this._pickable=e._pickable)}finalize(){this.pickingFBO&&this.pickingFBO.destroy(),this.depthFBO&&this.depthFBO.destroy()}pickObjectAsync(e){return this._pickClosestObjectAsync(e)}pickObjectsAsync(e){return this._pickVisibleObjectsAsync(e)}pickObject(e){return this._pickClosestObject(e)}pickObjects(e){return this._pickVisibleObjects(e)}getLastPickedObject({x:e,y:t,layers:n,viewports:s},r=this.lastPickedInfo.info){const o=r&&r.layer&&r.layer.id,a=r&&r.viewport&&r.viewport.id,c=o?n.find(d=>d.id===o):null,l=a&&s.find(d=>d.id===a)||s[0],u=l&&l.unproject([e-l.x,t-l.y]);return{...r,...{x:e,y:t,viewport:l,coordinate:u,layer:c}}}_resizeBuffer(e=this.device.getDefaultCanvasContext()){if(!this.pickingFBO){const s=this.device.createTexture({format:"rgba8unorm",width:1,height:1,usage:re.RENDER_ATTACHMENT|re.COPY_SRC});if(this.pickingFBO=this.device.createFramebuffer({colorAttachments:[s],depthStencilAttachment:"depth16unorm"}),this.device.isTextureFormatRenderable("rgba32float")){const r=this.device.createTexture({format:"rgba32float",width:1,height:1,usage:re.RENDER_ATTACHMENT|re.COPY_SRC}),o=this.device.createFramebuffer({colorAttachments:[r],depthStencilAttachment:"depth16unorm"});this.depthFBO=o}}const[t,n]=e.getDrawingBufferSize();this.pickingFBO?.resize({width:t,height:n}),this.depthFBO?.resize({width:t,height:n})}_getPickable(e){if(this._pickable===!1)return null;const t=e.filter(n=>this.pickLayersPass.shouldDrawLayer(n)&&!n.isComposite);return t.length?t:null}async _pickClosestObjectAsync({layers:e,views:t,viewports:n,x:s,y:r,radius:o=0,depth:a=1,mode:c="query",unproject3D:l,canvasContext:u=this.device.getDefaultCanvasContext(),onViewportActive:f,effects:d}){const h=u.cssToDeviceRatio(),g=this._getPickable(e);if(!g||n.length===0)return{result:[],emptyInfo:Pc({viewports:n,x:s,y:r,pixelRatio:h})};this._resizeBuffer(u);const p=u.cssToDevicePixels([s,r],!0),m=[p.x+Math.floor(p.width/2),p.y+Math.floor(p.height/2)],_=Math.round(o*h),{width:v,height:b}=this.pickingFBO,x=this._getPickingRect({deviceX:m[0],deviceY:m[1],deviceRadius:_,deviceWidth:v,deviceHeight:b}),w={x:s-o,y:r-o,width:o*2+1,height:o*2+1};let C;const B=[],F=new Set;for(let D=0;D<a;D++){let k;if(x){const z=await this._drawAndSampleAsync({layers:g,views:t,viewports:n,onViewportActive:f,deviceRect:x,cullRect:w,effects:d,pass:`picking:${c}`,canvasContext:u});k=pd({...z,deviceX:m[0],deviceY:m[1],deviceRadius:_,deviceRect:x})}else k={pickedColor:null,pickedObjectIndex:-1};let W;const G=this._getDepthLayers(k,g,l);if(G.length>0){const{pickedColors:z}=await this._drawAndSampleAsync({layers:G,views:t,viewports:n,onViewportActive:f,deviceRect:{x:k.pickedX??m[0],y:k.pickedY??m[1],width:1,height:1},cullRect:w,effects:d,pass:`picking:${c}:z`,canvasContext:u},!0);z[3]&&(W=z[0])}k.pickedLayer&&D+1<a&&(F.add(k.pickedLayer),k.pickedLayer.disablePickingIndex(k.pickedObjectIndex)),C=yd({pickInfo:k,lastPickedInfo:this.lastPickedInfo,mode:c,layers:g,viewports:n,x:s,y:r,z:W,pixelRatio:h});for(const z of C.values())z.layer&&B.push(z);if(!k.pickedColor)break}for(const D of F)D.restorePickingColors();return{result:B,emptyInfo:C.get(null)}}_pickClosestObject({layers:e,views:t,viewports:n,x:s,y:r,radius:o=0,depth:a=1,mode:c="query",unproject3D:l,canvasContext:u=this.device.getDefaultCanvasContext(),onViewportActive:f,effects:d}){const h=u.cssToDeviceRatio(),g=this._getPickable(e);if(!g||n.length===0)return{result:[],emptyInfo:Pc({viewports:n,x:s,y:r,pixelRatio:h})};this._resizeBuffer(u);const p=u.cssToDevicePixels([s,r],!0),m=[p.x+Math.floor(p.width/2),p.y+Math.floor(p.height/2)],_=Math.round(o*h),{width:v,height:b}=this.pickingFBO,x=this._getPickingRect({deviceX:m[0],deviceY:m[1],deviceRadius:_,deviceWidth:v,deviceHeight:b}),w={x:s-o,y:r-o,width:o*2+1,height:o*2+1};let C;const B=[],F=new Set;for(let D=0;D<a;D++){let k;if(x){const z=this._drawAndSample({layers:g,views:t,viewports:n,onViewportActive:f,deviceRect:x,cullRect:w,effects:d,pass:`picking:${c}`,canvasContext:u});k=pd({...z,deviceX:m[0],deviceY:m[1],deviceRadius:_,deviceRect:x})}else k={pickedColor:null,pickedObjectIndex:-1};let W;const G=this._getDepthLayers(k,g,l);if(G.length>0){const{pickedColors:z}=this._drawAndSample({layers:G,views:t,viewports:n,onViewportActive:f,deviceRect:{x:k.pickedX??m[0],y:k.pickedY??m[1],width:1,height:1},cullRect:w,effects:d,pass:`picking:${c}:z`,canvasContext:u},!0);z[3]&&(W=z[0])}k.pickedLayer&&D+1<a&&(F.add(k.pickedLayer),k.pickedLayer.disablePickingIndex(k.pickedObjectIndex)),C=yd({pickInfo:k,lastPickedInfo:this.lastPickedInfo,mode:c,layers:g,viewports:n,x:s,y:r,z:W,pixelRatio:h});for(const z of C.values())z.layer&&B.push(z);if(!k.pickedColor)break}for(const D of F)D.restorePickingColors();return{result:B,emptyInfo:C.get(null)}}async _pickVisibleObjectsAsync({layers:e,views:t,viewports:n,x:s,y:r,width:o=1,height:a=1,mode:c="query",maxObjects:l=null,canvasContext:u=this.device.getDefaultCanvasContext(),onViewportActive:f,effects:d}){const h=this._getPickable(e);if(!h||n.length===0)return[];this._resizeBuffer(u);const g=u.cssToDeviceRatio(),p=u.cssToDevicePixels([s,r],!0),m=p.x,_=p.y+p.height,v=u.cssToDevicePixels([s+o,r+a],!0),b=v.x+v.width,x=v.y,w={x:m,y:x,width:b-m,height:_-x},C=await this._drawAndSampleAsync({layers:h,views:t,viewports:n,onViewportActive:f,deviceRect:w,cullRect:{x:s,y:r,width:o,height:a},effects:d,pass:`picking:${c}`,canvasContext:u}),B=md(C),F=new Map,D=[],k=Number.isFinite(l);for(let W=0;W<B.length&&!(k&&D.length>=l);W++){const G=B[W];let z={color:G.pickedColor,layer:null,index:G.pickedObjectIndex,picked:!0,x:s,y:r,pixelRatio:g};z=Sc({layer:G.pickedLayer,info:z,mode:c});const V=z.layer.id;F.has(V)||F.set(V,new Set);const J=F.get(V),y=z.object??z.index;J.has(y)||(J.add(y),D.push(z))}return D}_pickVisibleObjects({layers:e,views:t,viewports:n,x:s,y:r,width:o=1,height:a=1,mode:c="query",maxObjects:l=null,canvasContext:u=this.device.getDefaultCanvasContext(),onViewportActive:f,effects:d}){const h=this._getPickable(e);if(!h||n.length===0)return[];this._resizeBuffer(u);const g=u.cssToDeviceRatio(),p=u.cssToDevicePixels([s,r],!0),m=p.x,_=p.y+p.height,v=u.cssToDevicePixels([s+o,r+a],!0),b=v.x+v.width,x=v.y,w={x:m,y:x,width:b-m,height:_-x},C=this._drawAndSample({layers:h,views:t,viewports:n,onViewportActive:f,deviceRect:w,cullRect:{x:s,y:r,width:o,height:a},effects:d,pass:`picking:${c}`,canvasContext:u}),B=md(C),F=new Map,D=[],k=Number.isFinite(l);for(let W=0;W<B.length&&!(k&&D.length>=l);W++){const G=B[W];let z={color:G.pickedColor,layer:null,index:G.pickedObjectIndex,picked:!0,x:s,y:r,pixelRatio:g};z=Sc({layer:G.pickedLayer,info:z,mode:c});const V=z.layer.id;F.has(V)||F.set(V,new Set);const J=F.get(V),y=z.object??z.index;J.has(y)||(J.add(y),D.push(z))}return D}async _drawAndSampleAsync({layers:e,views:t,viewports:n,onViewportActive:s,deviceRect:r,cullRect:o,effects:a,pass:c,canvasContext:l},u=!1){const f=u?this.depthFBO:this.pickingFBO,d={layers:e,layerFilter:this.layerFilter,views:t,viewports:n,onViewportActive:s,pickingFBO:f,deviceRect:r,cullRect:o,effects:a,pass:c,canvasContext:l,pickZ:u,preRenderStats:{},isPicking:!0};for(const w of a)w.useInPicking&&(d.preRenderStats[w.id]=w.preRender(d));const{decodePickingColor:h,stats:g}=this.pickLayersPass.render(d);this._updateStats(g);const{x:p,y:m,width:_,height:v}=r,b=f.colorAttachments[0]?.texture;if(!b)throw new Error("Picking framebuffer color attachment is missing");const x=await this._readTextureDataAsync(b,{x:p,y:m,width:_,height:v},u?Float32Array:Uint8Array);if(!u){let w=!1;for(let C=3;C<x.length;C+=4)if(x[C]!==0){w=!0;break}!w&&x.length>0&&K.warn("Async pick readback returned only zero alpha values",{deviceRect:r,bytes:Array.from(x.subarray(0,Math.min(x.length,16)))})()}return{pickedColors:x,decodePickingColor:h}}async _readTextureDataAsync(e,t,n){const{width:s,height:r}=t,o=e.computeMemoryLayout(t),a=this.device.createBuffer({byteLength:o.byteLength,usage:q.COPY_DST|q.MAP_READ});try{e.readBuffer(t,a);const c=await a.readAsync(0,o.byteLength),l=n.BYTES_PER_ELEMENT;if(o.bytesPerRow%l!==0)throw new Error(`Texture readback row stride ${o.bytesPerRow} is not aligned to ${l}-byte elements.`);const u=new n(c.buffer,c.byteOffset,o.byteLength/l),f=s*4,d=o.bytesPerRow/l;if(d<f)throw new Error(`Texture readback row stride ${d} is smaller than packed row length ${f}.`);const h=new n(s*r*4);for(let g=0;g<r;g++){const p=g*d;h.set(u.subarray(p,p+f),g*f)}return h}finally{a.destroy()}}_drawAndSample({layers:e,views:t,viewports:n,onViewportActive:s,deviceRect:r,cullRect:o,effects:a,pass:c,canvasContext:l},u=!1){const f=u?this.depthFBO:this.pickingFBO,d={layers:e,layerFilter:this.layerFilter,views:t,viewports:n,onViewportActive:s,pickingFBO:f,deviceRect:r,cullRect:o,effects:a,pass:c,canvasContext:l,pickZ:u,preRenderStats:{},isPicking:!0};for(const x of a)x.useInPicking&&(d.preRenderStats[x.id]=x.preRender(d));const{decodePickingColor:h,stats:g}=this.pickLayersPass.render(d);this._updateStats(g);const{x:p,y:m,width:_,height:v}=r,b=new(u?Float32Array:Uint8Array)(_*v*4);return this.device.readPixelsToArrayWebGL(f,{sourceX:p,sourceY:m,sourceWidth:_,sourceHeight:v,target:b}),{pickedColors:b,decodePickingColor:h}}_updateStats(e){if(!this.stats)return;let t=0;for(const{visibleCount:n}of e)t+=n;this.stats.get("Layers picked").addCount(t)}_getDepthLayers(e,t,n){if(!n||!this.depthFBO)return[];const{pickedLayer:s}=e,r=s?.state?.terrainDrawMode==="drape";return s&&!r?[s]:t.filter(o=>o.props.operation.includes("terrain"))}_getPickingRect({deviceX:e,deviceY:t,deviceRadius:n,deviceWidth:s,deviceHeight:r}){const o=Math.max(0,e-n),a=Math.max(0,t-n),c=Math.min(s,e+n+1)-o,l=Math.min(r,t+n+1)-a;return c<=0||l<=0?null:{x:o,y:a,width:c,height:l}}}const $L={"top-left":{top:0,left:0},"top-right":{top:0,right:0},"bottom-left":{bottom:0,left:0},"bottom-right":{bottom:0,right:0},fill:{top:0,left:0,bottom:0,right:0}},GL="top-left",_d="root";class VL{constructor({deck:e,parentElement:t}){this.defaultWidgets=[],this.widgets=[],this.resolvedWidgets=[],this.containers={},this.lastViewports={},this.deck=e,t?.classList.add("deck-widget-container"),this.parentElement=t}getWidgets(){return this.resolvedWidgets}setProps(e){if(e.widgets&&!Me(e.widgets,this.widgets,1)){const t=e.widgets.filter(Boolean);this._setWidgets(t)}}finalize(){for(const e of this.getWidgets())this._removeWidget(e);this.defaultWidgets.length=0,this.resolvedWidgets.length=0;for(const e in this.containers)this.containers[e].remove()}addDefault(e){this.defaultWidgets.find(t=>t.id===e.id)||(this._addWidget(e),this.defaultWidgets.push(e),this._setWidgets(this.widgets))}onRedraw({viewports:e,layers:t}){const n=e.reduce((s,r)=>(s[r.id]=r,s),{});for(const s of this.getWidgets()){const{viewId:r}=s;if(r){const o=n[r];o&&(s.onViewportChange&&s.onViewportChange(o),s.onRedraw?.({viewports:[o],layers:t}))}else{if(s.onViewportChange)for(const o of e)s.onViewportChange(o);s.onRedraw?.({viewports:e,layers:t})}}this.lastViewports=n,this._updateContainers()}onHover(e,t){for(const n of this.getWidgets()){const{viewId:s}=n;(!s||s===e.viewport?.id)&&n.onHover?.(e,t)}}getCanvasBounds(e){const n=this.deck?.getCanvas?.()?.getBoundingClientRect(),s=this.parentElement?.getBoundingClientRect(),r=this.deck?.getCanvasContext?.(e?.id);if(r&&s){r.updatePosition();const[o,a]=r.getPosition(),[c,l]=r.getCSSSize();return{x:o-s.left,y:a-s.top,width:c,height:l}}return{x:n&&s?n.left-s.left:0,y:n&&s?n.top-s.top:0,width:n?.width||this.deck?.width||0,height:n?.height||this.deck?.height||0}}onEvent(e,t){const n=Ws[t.type];if(n)for(const s of this.getWidgets()){const{viewId:r}=s;(!r||r===e.viewport?.id)&&s[n]?.(e,t)}}_setWidgets(e){const t={};for(const n of this.resolvedWidgets)t[n.id]=n;this.resolvedWidgets.length=0;for(const n of this.defaultWidgets)t[n.id]=null,this.resolvedWidgets.push(n);for(let n of e){const s=t[n.id];s?s.viewId!==n.viewId||s.placement!==n.placement?(this._removeWidget(s),this._addWidget(n)):n!==s&&(s.setProps(n.props),n=s):this._addWidget(n),t[n.id]=null,this.resolvedWidgets.push(n)}for(const n in t){const s=t[n];s&&this._removeWidget(s)}this.widgets=e}_addWidget(e){const{viewId:t=null,placement:n=GL}=e,s=e.props._container??t;e.widgetManager=this,e.deck=this.deck,e.rootElement=e._onAdd({deck:this.deck,viewId:t}),e.rootElement&&this._getContainer(s,n).append(e.rootElement),e.updateHTML()}_removeWidget(e){e.onRemove?.(),e.rootElement&&e.rootElement.remove(),e.rootElement=void 0,e.deck=void 0,e.widgetManager=void 0}_getContainer(e,t){if(e&&typeof e!="string")return e;const n=e||_d;let s=this.containers[n];s||(s=document.createElement("div"),s.style.pointerEvents="none",s.style.position="absolute",s.style.overflow="hidden",this.parentElement?.append(s),this.containers[n]=s);let r=s.querySelector(`.${t}`);return r||(r=globalThis.document.createElement("div"),r.className=t,r.style.position="absolute",r.style.zIndex="2",Object.assign(r.style,$L[t]),s.append(r)),r}_updateContainers(){for(const e in this.containers){const t=this.lastViewports[e]||null,n=e===_d||t,s=this.containers[e];if(n){const r=this._getContainerBounds(t);s.style.display="block",s.style.left=`${r.x}px`,s.style.top=`${r.y}px`,s.style.width=`${r.width}px`,s.style.height=`${r.height}px`}else s.style.display="none"}}_getContainerBounds(e){if(!e)return{x:0,y:0,width:this.parentElement?.clientWidth||this.deck.width,height:this.parentElement?.clientHeight||this.deck.height};const t=this.getCanvasBounds(e);return{x:t.x+e.x,y:t.y+e.y,width:e.width,height:e.height}}}function bd(i,e){e&&Object.entries(e).map(([t,n])=>{t.startsWith("--")?i.style.setProperty(t,n):i.style[t]=n})}function jL(i,e){e&&Object.keys(e).map(t=>{t.startsWith("--")?i.style.removeProperty(t):i.style[t]=""})}class Vl{constructor(e){this.viewId=null,this.props={...this.constructor.defaultProps,...e},this.id=this.props.id}setProps(e){const t=this.props,n=this.rootElement;n&&t.className!==e.className&&(t.className&&n.classList.remove(t.className),e.className&&n.classList.add(e.className)),n&&!Me(t.style,e.style,1)&&(jL(n,t.style),bd(n,e.style)),Object.assign(this.props,e),this.updateHTML()}updateHTML(){this.rootElement&&this.onRenderHTML(this.rootElement)}get viewIds(){return this.viewId?[this.viewId]:this.deck?.getViews().map(e=>e.id)??[]}getViewState(e){return this.deck?.viewManager?.getViewState(e)||{}}setViewState(e,t){this.deck?._onViewStateChange({viewId:e,viewState:t,interactionState:{}})}onCreateRootElement(){const e=["deck-widget",this.className,this.props.className],t=document.createElement("div");return e.filter(n=>typeof n=="string"&&n.length>0).forEach(n=>t.classList.add(n)),bd(t,this.props.style),t}_onAdd(e){return this.onAdd(e)??this.onCreateRootElement()}onAdd(e){}onRemove(){}onViewportChange(e){}onRedraw(e){}onHover(e,t){}onClick(e,t){}onDrag(e,t){}onDragStart(e,t){}onDragEnd(e,t){}}Vl.defaultProps={id:"widget",style:{},_container:null,className:""};const WL={zIndex:"1",position:"absolute",pointerEvents:"none",color:"#a0a7b4",backgroundColor:"#29323c",padding:"10px",top:"0",left:"0",display:"none"};class am extends Vl{constructor(e={}){super(e),this.id="default-tooltip",this.placement="fill",this.className="deck-tooltip",this.isVisible=!1,this.setProps(e)}onCreateRootElement(){const e=document.createElement("div");return e.className=this.className,Object.assign(e.style,WL),e}onRenderHTML(e){}onViewportChange(e){this.isVisible&&e.id===this.lastViewport?.id&&!e.equals(this.lastViewport)&&this.setTooltip(null),this.lastViewport=e}onHover(e){const{deck:t}=this,n=t&&t.props.getTooltip;if(!n)return;const s=n(e),r=this.widgetManager?.getCanvasBounds(e.viewport),o=e.x+(r?.x||0),a=e.y+(r?.y||0);this.setTooltip(s,o,a)}setTooltip(e,t,n){const s=this.rootElement;if(s){if(typeof e=="string")s.innerText=e;else if(e)e.text&&(s.innerText=e.text),e.html&&(s.innerHTML=e.html),e.className&&(s.className=e.className);else{this.isVisible=!1,s.style.display="none";return}this.isVisible=!0,s.style.display="block",s.style.transform=`translate(${t}px, ${n}px)`,e&&typeof e=="object"&&"style"in e&&Object.assign(s.style,e.style)}}}am.defaultProps={...Vl.defaultProps};class HL{constructor(e){this.targets={},this.order=[],this.eventManagers={},this._eventRootToCanvasId=new WeakMap,this._createEventManager=e.createEventManager,this._getEventRoot=e.getEventRoot}finalize(){for(const e of Object.values(this.targets))e.eventManager.destroy(),e.presentationContext.destroy();this.targets={},this.order=[],this.eventManagers={},this._eventRootToCanvasId=new WeakMap}syncCanvasEntries(e){const t=this._normalizeCanvasList(e.canvases),n={},s=[],r=new Map;for(const{canvas:a}of t){const c=this._getEventRoot(a);r.set(c,(r.get(c)||0)+1)}for(const{id:a,canvas:c}of t){const l=this._getEventRoot(c),u=r.get(l)===1?l:c;let f=this.targets[a];if(!f||f.device!==e.device||f.canvas!==c||f.eventRoot!==u){f?.eventManager.destroy(),f?.presentationContext.destroy();const d=e.device.createPresentationContext({id:a,canvas:c,useDevicePixels:e.useDevicePixels,autoResize:!0});f={id:a,device:e.device,canvas:c,eventRoot:u,presentationContext:d,eventManager:this._createEventManager(u)}}this._eventRootToCanvasId.set(u,a),this._eventRootToCanvasId.set(c,a),n[a]=f,s.push(a)}for(const[a,c]of Object.entries(this.targets))n[a]||(c.eventManager.destroy(),c.presentationContext.destroy());this.targets=n,this.order=s;const o=Object.fromEntries(Object.entries(n).map(([a,c])=>[a,c.eventManager]));this._haveSameEventManagers(o)||(this.eventManagers=o)}getCanvasIdFromEvent(e){return e?this._eventRootToCanvasId.get(e):void 0}getTarget(e){return this.targets[e||this.order[0]||Gi]||null}_normalizeCanvasList(e=[]){const t=new Set;return e.map((n,s)=>{let r,o;return typeof n=="string"?(r=document.getElementById(n),he(r,`Canvas with id ${n} not found`),o=n):(r=n,o=r.id||`deckgl-canvas-${s}`),he(!t.has(o),`Duplicate canvas id ${o}`),t.add(o),{id:o,canvas:r}})}_haveSameEventManagers(e){const t=Object.keys(e),n=Object.keys(this.eventManagers);return t.length===n.length&&t.every(s=>e[s]===this.eventManagers[s])}}const YL={WEBGL_depth_texture:{UNSIGNED_INT_24_8_WEBGL:34042},OES_element_index_uint:{},OES_texture_float:{},OES_texture_half_float:{HALF_FLOAT_OES:5131},EXT_color_buffer_float:{},OES_standard_derivatives:{FRAGMENT_SHADER_DERIVATIVE_HINT_OES:35723},EXT_frag_depth:{},EXT_blend_minmax:{MIN_EXT:32775,MAX_EXT:32776},EXT_shader_texture_lod:{}},qL=i=>({drawBuffersWEBGL(e){return i.drawBuffers(e)},COLOR_ATTACHMENT0_WEBGL:36064,COLOR_ATTACHMENT1_WEBGL:36065,COLOR_ATTACHMENT2_WEBGL:36066,COLOR_ATTACHMENT3_WEBGL:36067}),ZL=i=>({VERTEX_ARRAY_BINDING_OES:34229,createVertexArrayOES(){return i.createVertexArray()},deleteVertexArrayOES(e){return i.deleteVertexArray(e)},isVertexArrayOES(e){return i.isVertexArray(e)},bindVertexArrayOES(e){return i.bindVertexArray(e)}}),XL=i=>({VERTEX_ATTRIB_ARRAY_DIVISOR_ANGLE:35070,drawArraysInstancedANGLE(...e){return i.drawArraysInstanced(...e)},drawElementsInstancedANGLE(...e){return i.drawElementsInstanced(...e)},vertexAttribDivisorANGLE(...e){return i.vertexAttribDivisor(...e)}});function KL(i=!0){const e=HTMLCanvasElement.prototype;if(!i&&e.originalGetContext){e.getContext=e.originalGetContext,e.originalGetContext=void 0;return}e.originalGetContext=e.getContext,e.getContext=function(t,n){if(t==="webgl"||t==="experimental-webgl"){const s=this.originalGetContext("webgl2",n);return s instanceof HTMLElement&&QL(s),s}return this.originalGetContext(t,n)}}function QL(i){i.getExtension("EXT_color_buffer_float");const e={...YL,WEBGL_disjoint_timer_query:i.getExtension("EXT_disjoint_timer_query_webgl2"),WEBGL_draw_buffers:qL(i),OES_vertex_array_object:ZL(i),ANGLE_instanced_arrays:XL(i)},t=i.getExtension.bind(i);i.getExtension=function(s){const r=t(s);return r||(s in e?e[s]:null)};const n=i.getSupportedExtensions;i.getSupportedExtensions=function(){return(n.apply(i)||[])?.concat(Object.keys(e))}}let vd=!1;async function JL(){{jl();return}}function eT(i,e){return jl(),i}async function tT(i){{jl();return}}function iT(i){return null}function jl(){vd||(vd=!0,A.warn("Import @luma.gl/webgl/debug before enabling WebGL debugging.")())}const hn=1;class nT extends t0{type="webgl";enforceWebGL2(e){KL(e)}isSupported(){return typeof WebGL2RenderingContext<"u"}isDeviceHandle(e){return typeof WebGL2RenderingContext<"u"&&e instanceof WebGL2RenderingContext?!0:(typeof WebGLRenderingContext<"u"&&e instanceof WebGLRenderingContext&&A.warn("WebGL1 is not supported",e)(),!1)}async attach(e,t={}){const{WebGLDevice:n}=await ir(async()=>{const{WebGLDevice:o}=await Promise.resolve().then(()=>Fd);return{WebGLDevice:o}},void 0);if(e instanceof n)return e;const s=n.getDeviceFromContext(e);if(s)return s;if(!sT(e))throw new Error("Invalid WebGL2RenderingContext");t=xd(t),await wd(t);const r=t.createCanvasContext===!0?{}:t.createCanvasContext;return new n({...t,_handle:e,createCanvasContext:{canvas:e.canvas,autoResize:!1,...r}})}async create(e={}){const{WebGLDevice:t}=await ir(async()=>{const{WebGLDevice:n}=await Promise.resolve().then(()=>Fd);return{WebGLDevice:n}},void 0);e=xd(e),await wd(e);try{const n=new t(e);A.groupCollapsed(hn,`WebGLDevice ${n.id} created`)();const s=`${n._reused?"Reusing":"Created"} device with WebGL2 ${n.props.debug?"debug ":""}context: ${n.info.vendor}, ${n.info.renderer} for canvas: ${n.canvasContext.id}`;return A.probe(hn,s)(),A.table(hn,n.info)(),n}finally{A.groupEnd(hn)(),A.info(hn,"%cWebGL call tracing: luma.log.set('debug-webgl') ","color: white; background: blue; padding: 2px 6px; border-radius: 3px;")()}}}function sT(i){return typeof WebGL2RenderingContext<"u"&&i instanceof WebGL2RenderingContext?!0:!!(i&&typeof i.createVertexArray=="function")}const ca=new nT;function xd(i){return{...i,debug:i.debug??Wi.defaultProps.debug,debugWebGL:i.debugWebGL??Wi.defaultProps.debugWebGL,debugSpectorJS:i.debugSpectorJS??!!A.get("debug-spectorjs")}}async function wd(i){const e=[];(i.debugWebGL||i.debug)&&e.push(JL()),i.debugSpectorJS&&e.push(tT());const t=await Promise.allSettled(e);for(const n of t)n.status==="rejected"&&A.error(`Failed to initialize debug libraries ${n.reason}`)()}const Wl={3042:!1,32773:new Float32Array([0,0,0,0]),32777:32774,34877:32774,32969:1,32968:0,32971:1,32970:0,3106:new Float32Array([0,0,0,0]),3107:[!0,!0,!0,!0],2884:!1,2885:1029,2929:!1,2931:1,2932:513,2928:new Float32Array([0,1]),2930:!0,3024:!0,35725:null,36006:null,36007:null,34229:null,34964:null,2886:2305,33170:4352,2849:1,32823:!1,32824:0,10752:0,32926:!1,32928:!1,32938:1,32939:!1,3089:!1,3088:new Int32Array([0,0,1024,1024]),2960:!1,2961:0,2968:4294967295,36005:4294967295,2962:519,2967:0,2963:4294967295,34816:519,36003:0,36004:4294967295,2964:7680,2965:7680,2966:7680,34817:7680,34818:7680,34819:7680,2978:[0,0,1024,1024],36389:null,36662:null,36663:null,35053:null,35055:null,35723:4352,36010:null,35977:!1,3333:4,3317:4,37440:!1,37441:!1,37443:37444,3330:0,3332:0,3331:0,3314:0,32878:0,3316:0,3315:0,32877:0},_e=(i,e,t)=>e?i.enable(t):i.disable(t),Pd=(i,e,t)=>i.hint(t,e),De=(i,e,t)=>i.pixelStorei(t,e),Sd=(i,e,t)=>{const n=t===36006?36009:36008;return i.bindFramebuffer(n,e)},gn=(i,e,t)=>{const s={34964:34962,36662:36662,36663:36663,35053:35051,35055:35052}[t];i.bindBuffer(s,e)};function la(i){return Array.isArray(i)||ArrayBuffer.isView(i)&&!(i instanceof DataView)}const rT={3042:_e,32773:(i,e)=>i.blendColor(...e),32777:"blendEquation",34877:"blendEquation",32969:"blendFunc",32968:"blendFunc",32971:"blendFunc",32970:"blendFunc",3106:(i,e)=>i.clearColor(...e),3107:(i,e)=>i.colorMask(...e),2884:_e,2885:(i,e)=>i.cullFace(e),2929:_e,2931:(i,e)=>i.clearDepth(e),2932:(i,e)=>i.depthFunc(e),2928:(i,e)=>i.depthRange(...e),2930:(i,e)=>i.depthMask(e),3024:_e,35723:Pd,35725:(i,e)=>i.useProgram(e),36007:(i,e)=>i.bindRenderbuffer(36161,e),36389:(i,e)=>i.bindTransformFeedback?.(36386,e),34229:(i,e)=>i.bindVertexArray(e),36006:Sd,36010:Sd,34964:gn,36662:gn,36663:gn,35053:gn,35055:gn,2886:(i,e)=>i.frontFace(e),33170:Pd,2849:(i,e)=>i.lineWidth(e),32823:_e,32824:"polygonOffset",10752:"polygonOffset",35977:_e,32926:_e,32928:_e,32938:"sampleCoverage",32939:"sampleCoverage",3089:_e,3088:(i,e)=>i.scissor(...e),2960:_e,2961:(i,e)=>i.clearStencil(e),2968:(i,e)=>i.stencilMaskSeparate(1028,e),36005:(i,e)=>i.stencilMaskSeparate(1029,e),2962:"stencilFuncFront",2967:"stencilFuncFront",2963:"stencilFuncFront",34816:"stencilFuncBack",36003:"stencilFuncBack",36004:"stencilFuncBack",2964:"stencilOpFront",2965:"stencilOpFront",2966:"stencilOpFront",34817:"stencilOpBack",34818:"stencilOpBack",34819:"stencilOpBack",2978:(i,e)=>i.viewport(...e),34383:_e,10754:_e,12288:_e,12289:_e,12290:_e,12291:_e,12292:_e,12293:_e,12294:_e,12295:_e,3333:De,3317:De,37440:De,37441:De,37443:De,3330:De,3332:De,3331:De,3314:De,32878:De,3316:De,3315:De,32877:De,framebuffer:(i,e)=>{const t=e&&"handle"in e?e.handle:e;return i.bindFramebuffer(36160,t)},blend:(i,e)=>e?i.enable(3042):i.disable(3042),blendColor:(i,e)=>i.blendColor(...e),blendEquation:(i,e)=>{const t=typeof e=="number"?[e,e]:e;i.blendEquationSeparate(...t)},blendFunc:(i,e)=>{const t=e?.length===2?[...e,...e]:e;i.blendFuncSeparate(...t)},clearColor:(i,e)=>i.clearColor(...e),clearDepth:(i,e)=>i.clearDepth(e),clearStencil:(i,e)=>i.clearStencil(e),colorMask:(i,e)=>i.colorMask(...e),cull:(i,e)=>e?i.enable(2884):i.disable(2884),cullFace:(i,e)=>i.cullFace(e),depthTest:(i,e)=>e?i.enable(2929):i.disable(2929),depthFunc:(i,e)=>i.depthFunc(e),depthMask:(i,e)=>i.depthMask(e),depthRange:(i,e)=>i.depthRange(...e),dither:(i,e)=>e?i.enable(3024):i.disable(3024),derivativeHint:(i,e)=>{i.hint(35723,e)},frontFace:(i,e)=>i.frontFace(e),mipmapHint:(i,e)=>i.hint(33170,e),lineWidth:(i,e)=>i.lineWidth(e),polygonOffsetFill:(i,e)=>e?i.enable(32823):i.disable(32823),polygonOffset:(i,e)=>i.polygonOffset(...e),sampleCoverage:(i,e)=>i.sampleCoverage(e[0],e[1]||!1),scissorTest:(i,e)=>e?i.enable(3089):i.disable(3089),scissor:(i,e)=>i.scissor(...e),stencilTest:(i,e)=>e?i.enable(2960):i.disable(2960),stencilMask:(i,e)=>{e=la(e)?e:[e,e];const[t,n]=e;i.stencilMaskSeparate(1028,t),i.stencilMaskSeparate(1029,n)},stencilFunc:(i,e)=>{e=la(e)&&e.length===3?[...e,...e]:e;const[t,n,s,r,o,a]=e;i.stencilFuncSeparate(1028,t,n,s),i.stencilFuncSeparate(1029,r,o,a)},stencilOp:(i,e)=>{e=la(e)&&e.length===3?[...e,...e]:e;const[t,n,s,r,o,a]=e;i.stencilOpSeparate(1028,t,n,s),i.stencilOpSeparate(1029,r,o,a)},viewport:(i,e)=>i.viewport(...e)};function ye(i,e,t){return e[i]!==void 0?e[i]:t[i]}const oT={blendEquation:(i,e,t)=>i.blendEquationSeparate(ye(32777,e,t),ye(34877,e,t)),blendFunc:(i,e,t)=>i.blendFuncSeparate(ye(32969,e,t),ye(32968,e,t),ye(32971,e,t),ye(32970,e,t)),polygonOffset:(i,e,t)=>i.polygonOffset(ye(32824,e,t),ye(10752,e,t)),sampleCoverage:(i,e,t)=>i.sampleCoverage(ye(32938,e,t),ye(32939,e,t)),stencilFuncFront:(i,e,t)=>i.stencilFuncSeparate(1028,ye(2962,e,t),ye(2967,e,t),ye(2963,e,t)),stencilFuncBack:(i,e,t)=>i.stencilFuncSeparate(1029,ye(34816,e,t),ye(36003,e,t),ye(36004,e,t)),stencilOpFront:(i,e,t)=>i.stencilOpSeparate(1028,ye(2964,e,t),ye(2965,e,t),ye(2966,e,t)),stencilOpBack:(i,e,t)=>i.stencilOpSeparate(1029,ye(34817,e,t),ye(34818,e,t),ye(34819,e,t))},Ed={enable:(i,e)=>i({[e]:!0}),disable:(i,e)=>i({[e]:!1}),pixelStorei:(i,e,t)=>i({[e]:t}),hint:(i,e,t)=>i({[e]:t}),useProgram:(i,e)=>i({35725:e}),bindRenderbuffer:(i,e,t)=>i({36007:t}),bindTransformFeedback:(i,e,t)=>i({36389:t}),bindVertexArray:(i,e)=>i({34229:e}),bindFramebuffer:(i,e,t)=>{switch(e){case 36160:return i({36006:t,36010:t});case 36009:return i({36006:t});case 36008:return i({36010:t});default:return null}},bindBuffer:(i,e,t)=>{const n={34962:[34964],36662:[36662],36663:[36663],35051:[35053],35052:[35055]}[e];return n?i({[n]:t}):{valueChanged:!0}},blendColor:(i,e,t,n,s)=>i({32773:new Float32Array([e,t,n,s])}),blendEquation:(i,e)=>i({32777:e,34877:e}),blendEquationSeparate:(i,e,t)=>i({32777:e,34877:t}),blendFunc:(i,e,t)=>i({32969:e,32968:t,32971:e,32970:t}),blendFuncSeparate:(i,e,t,n,s)=>i({32969:e,32968:t,32971:n,32970:s}),clearColor:(i,e,t,n,s)=>i({3106:new Float32Array([e,t,n,s])}),clearDepth:(i,e)=>i({2931:e}),clearStencil:(i,e)=>i({2961:e}),colorMask:(i,e,t,n,s)=>i({3107:[e,t,n,s]}),cullFace:(i,e)=>i({2885:e}),depthFunc:(i,e)=>i({2932:e}),depthRange:(i,e,t)=>i({2928:new Float32Array([e,t])}),depthMask:(i,e)=>i({2930:e}),frontFace:(i,e)=>i({2886:e}),lineWidth:(i,e)=>i({2849:e}),polygonOffset:(i,e,t)=>i({32824:e,10752:t}),sampleCoverage:(i,e,t)=>i({32938:e,32939:t}),scissor:(i,e,t,n,s)=>i({3088:new Int32Array([e,t,n,s])}),stencilMask:(i,e)=>i({2968:e,36005:e}),stencilMaskSeparate:(i,e,t)=>i({[e===1028?2968:36005]:t}),stencilFunc:(i,e,t,n)=>i({2962:e,2967:t,2963:n,34816:e,36003:t,36004:n}),stencilFuncSeparate:(i,e,t,n,s)=>i({[e===1028?2962:34816]:t,[e===1028?2967:36003]:n,[e===1028?2963:36004]:s}),stencilOp:(i,e,t,n)=>i({2964:e,2965:t,2966:n,34817:e,34818:t,34819:n}),stencilOpSeparate:(i,e,t,n,s)=>i({[e===1028?2964:34817]:t,[e===1028?2965:34818]:n,[e===1028?2966:34819]:s}),viewport:(i,e,t,n,s)=>i({2978:[e,t,n,s]})},ot=(i,e)=>i.isEnabled(e),Cd={3042:ot,2884:ot,2929:ot,3024:ot,32823:ot,32926:ot,32928:ot,3089:ot,2960:ot,35977:ot},aT=new Set([34016,36388,36387,35983,35368,34965,35739,35738,3074,34853,34854,34855,34856,34857,34858,34859,34860,34861,34862,34863,34864,34865,34866,34867,34868,35097,32873,35869,32874,34068]);function cn(i,e){if(lT(e))return;const t={};for(const s in e){const r=Number(s),o=rT[s];o&&(typeof o=="string"?t[o]=!0:o(i,e[s],r))}const n=i.lumaState?.cache;if(n)for(const s in t){const r=oT[s];r(i,e,n)}}function cm(i,e=Wl){if(typeof e=="number"){const s=e,r=Cd[s];return r?r(i,s):i.getParameter(s)}const t=Array.isArray(e)?e:Object.keys(e),n={};for(const s of t){const r=Cd[s];n[s]=r?r(i,Number(s)):i.getParameter(Number(s))}return n}function cT(i){cn(i,Wl)}function lT(i){for(const e in i)return!1;return!0}function uT(i,e){if(i===e)return!0;if(Ld(i)&&Ld(e)&&i.length===e.length){for(let t=0;t<i.length;++t)if(i[t]!==e[t])return!1;return!0}return!1}function Ld(i){return Array.isArray(i)||ArrayBuffer.isView(i)}class ri{static get(e){return e.lumaState}gl;program=null;stateStack=[];enable=!0;cache=null;log;initialized=!1;constructor(e,t){this.gl=e,this.log=t?.log||(()=>{}),this._updateCache=this._updateCache.bind(this),Object.seal(this)}push(e={}){this.stateStack.push({})}pop(){const e=this.stateStack[this.stateStack.length-1];cn(this.gl,e),this.stateStack.pop()}trackState(e,t){if(this.cache=t?.copyState?cm(e):Object.assign({},Wl),this.initialized)throw new Error("WebGLStateTracker");this.initialized=!0,this.gl.lumaState=this,dT(e);for(const n in Ed){const s=Ed[n];fT(e,n,s)}Td(e,"getParameter"),Td(e,"isEnabled")}_updateCache(e){let t=!1,n;const s=this.stateStack.length>0?this.stateStack[this.stateStack.length-1]:null;for(const r in e){const o=e[r],a=this.cache[r];uT(o,a)||(t=!0,n=a,s&&!(r in s)&&(s[r]=a),this.cache[r]=o)}return{valueChanged:t,oldValue:n}}}function Td(i,e){const t=i[e].bind(i);i[e]=function(s){if(s===void 0||aT.has(s))return t(s);const r=ri.get(i);return s in r.cache||(r.cache[s]=t(s)),r.enable?r.cache[s]:t(s)},Object.defineProperty(i[e],"name",{value:`${e}-from-cache`,configurable:!1})}function fT(i,e,t){if(!i[e])return;const n=i[e].bind(i);i[e]=function(...r){const o=ri.get(i),{valueChanged:a,oldValue:c}=t(o._updateCache,...r);return a&&n(...r),c},Object.defineProperty(i[e],"name",{value:`${e}-to-cache`,configurable:!1})}function dT(i){const e=i.useProgram.bind(i);i.useProgram=function(n){const s=ri.get(i);s.program!==n&&(e(n),s.program=n)}}function Ec(i){const e=i.luma||{_polyfilled:!1,extensions:{},softwareRenderer:!1};return e._polyfilled??=!1,e.extensions||={},i.luma=e,e}function hT(i,e,t){let n="";const s=c=>{const l=c.statusMessage;l&&(n||=l)};i.addEventListener("webglcontextcreationerror",s,!1);const r=t.failIfMajorPerformanceCaveat!==!0,o={preserveDrawingBuffer:!0,...t,failIfMajorPerformanceCaveat:!0};let a=null;try{a||=i.getContext("webgl2",o),!a&&o.failIfMajorPerformanceCaveat&&(n||="Only software GPU is available. Set `failIfMajorPerformanceCaveat: false` to allow.");let c=!1;if(!a&&r&&(o.failIfMajorPerformanceCaveat=!1,a=i.getContext("webgl2",o),c=!0),a||(a=i.getContext("webgl",{}),a&&(a=null,n||="Your browser only supports WebGL1")),!a)throw n||="Your browser does not support WebGL",new Error(`Failed to create WebGL context: ${n}`);const l=Ec(a);l.softwareRenderer=c;const{onContextLost:u,onContextRestored:f}=e;return i.addEventListener("webglcontextlost",d=>u(d),!1),i.addEventListener("webglcontextrestored",d=>f(d),!1),a}finally{i.removeEventListener("webglcontextcreationerror",s,!1)}}function hi(i,e,t){return t[e]===void 0&&(t[e]=i.getExtension(e)||null),t[e]}function gT(i,e){const t=i.getParameter(7936),n=i.getParameter(7937);hi(i,"WEBGL_debug_renderer_info",e);const s=e.WEBGL_debug_renderer_info,r=i.getParameter(s?s.UNMASKED_VENDOR_WEBGL:7936),o=i.getParameter(s?s.UNMASKED_RENDERER_WEBGL:7937),a=r||t,c=o||n,l=i.getParameter(7938),u=lm(a,c),f=pT(a,c),d=mT(a,c);return{type:"webgl",gpu:u,gpuType:d,gpuBackend:f,vendor:a,renderer:c,version:l,shadingLanguage:"glsl",shadingLanguageVersion:300}}function lm(i,e){return/NVIDIA/i.exec(i)||/NVIDIA/i.exec(e)?"nvidia":/INTEL/i.exec(i)||/INTEL/i.exec(e)?"intel":/Apple/i.exec(i)||/Apple/i.exec(e)?"apple":/AMD/i.exec(i)||/AMD/i.exec(e)||/ATI/i.exec(i)||/ATI/i.exec(e)?"amd":/SwiftShader/i.exec(i)||/SwiftShader/i.exec(e)?"software":"unknown"}function pT(i,e){return/Metal/i.exec(i)||/Metal/i.exec(e)?"metal":/ANGLE/i.exec(i)||/ANGLE/i.exec(e)?"opengl":"unknown"}function mT(i,e){if(/SwiftShader/i.exec(i)||/SwiftShader/i.exec(e))return"cpu";switch(lm(i,e)){case"apple":return yT(i,e)?"integrated":"unknown";case"intel":return"integrated";case"software":return"cpu";case"unknown":return"unknown";default:return"discrete"}}function yT(i,e){return/Apple (M\d|A\d|GPU)/i.test(`${i} ${e}`)}function um(i){switch(i){case"uint8":return 5121;case"sint8":return 5120;case"unorm8":return 5121;case"snorm8":return 5120;case"uint16":return 5123;case"sint16":return 5122;case"unorm16":return 5123;case"snorm16":return 5122;case"uint32":return 5125;case"sint32":return 5124;case"float16":return 5131;case"float32":return 5126}throw new Error(String(i))}const Cn="WEBGL_compressed_texture_s3tc",Ln="WEBGL_compressed_texture_s3tc_srgb",Bi="EXT_texture_compression_rgtc",Di="EXT_texture_compression_bptc",_T="WEBGL_compressed_texture_etc",bT="WEBGL_compressed_texture_astc",vT="WEBGL_compressed_texture_etc1",xT="WEBGL_compressed_texture_pvrtc",wT="WEBGL_compressed_texture_atc",PT="EXT_texture_norm16",Ad="EXT_render_snorm",fm="EXT_color_buffer_float",ua="snorm8-renderable-webgl",fa="norm16-renderable-webgl",da="snorm16-renderable-webgl",ha="float16-renderable-webgl",Ls="float32-renderable-webgl",ST="rgb9e5ufloat-renderable-webgl",Hl={"float32-renderable-webgl":{extensions:[fm]},"float16-renderable-webgl":{extensions:["EXT_color_buffer_half_float"]},"rgb9e5ufloat-renderable-webgl":{extensions:["WEBGL_render_shared_exponent"]},"snorm8-renderable-webgl":{extensions:[Ad]},"norm16-webgl":{extensions:[PT]},"norm16-renderable-webgl":{features:["norm16-webgl"]},"snorm16-renderable-webgl":{features:["norm16-webgl"],extensions:[Ad]},"float32-filterable":{extensions:["OES_texture_float_linear"]},"float16-filterable-webgl":{extensions:["OES_texture_half_float_linear"]},"texture-filterable-anisotropic-webgl":{extensions:["EXT_texture_filter_anisotropic"]},"texture-blend-float-webgl":{extensions:["EXT_float_blend"]},"texture-compression-bc":{extensions:[Cn,Ln,Bi,Di]},"texture-compression-bc5-webgl":{extensions:[Bi]},"texture-compression-bc7-webgl":{extensions:[Di]},"texture-compression-etc2":{extensions:[_T]},"texture-compression-astc":{extensions:[bT]},"texture-compression-etc1-webgl":{extensions:[vT]},"texture-compression-pvrtc-webgl":{extensions:[xT]},"texture-compression-atc-webgl":{extensions:[wT]}};function ET(i){return i in Hl}function dm(i,e,t){return hm(i,e,t,new Set)}function hm(i,e,t,n){const s=Hl[e];if(!s||n.has(e))return!1;n.add(e);const r=(s.features||[]).every(o=>hm(i,o,t,n));return n.delete(e),r?(s.extensions||[]).every(o=>!!hi(i,o,t)):!1}const so={r8unorm:{gl:33321,rb:!0},r8snorm:{gl:36756,r:ua},r8uint:{gl:33330,rb:!0},r8sint:{gl:33329,rb:!0},rg8unorm:{gl:33323,rb:!0},rg8snorm:{gl:36757,r:ua},rg8uint:{gl:33336,rb:!0},rg8sint:{gl:33335,rb:!0},r16uint:{gl:33332,rb:!0},r16sint:{gl:33331,rb:!0},r16float:{gl:33325,rb:!0,r:ha},r16unorm:{gl:33322,rb:!0,r:fa},r16snorm:{gl:36760,r:da},"rgba4unorm-webgl":{gl:32854,rb:!0},"rgb565unorm-webgl":{gl:36194,rb:!0},"rgb5a1unorm-webgl":{gl:32855,rb:!0},"rgb8unorm-webgl":{gl:32849},"rgb8snorm-webgl":{gl:36758},rgba8unorm:{gl:32856},"rgba8unorm-srgb":{gl:35907},rgba8snorm:{gl:36759,r:ua},rgba8uint:{gl:36220},rgba8sint:{gl:36238},bgra8unorm:{},"bgra8unorm-srgb":{},rg16uint:{gl:33338},rg16sint:{gl:33337},rg16float:{gl:33327,rb:!0,r:ha},rg16unorm:{gl:33324,r:fa},rg16snorm:{gl:36761,r:da},r32uint:{gl:33334,rb:!0},r32sint:{gl:33333,rb:!0},r32float:{gl:33326,r:Ls},rgb9e5ufloat:{gl:35901,r:ST},rg11b10ufloat:{gl:35898,rb:!0},rgb10a2unorm:{gl:32857,rb:!0},rgb10a2uint:{gl:36975,rb:!0},"rgb16unorm-webgl":{gl:32852,r:!1},"rgb16snorm-webgl":{gl:36762,r:!1},rg32uint:{gl:33340,rb:!0},rg32sint:{gl:33339,rb:!0},rg32float:{gl:33328,rb:!0,r:Ls},rgba16uint:{gl:36214,rb:!0},rgba16sint:{gl:36232,rb:!0},rgba16float:{gl:34842,r:ha},rgba16unorm:{gl:32859,rb:!0,r:fa},rgba16snorm:{gl:36763,r:da},"rgb32float-webgl":{gl:34837,x:fm,r:Ls,dataFormat:6407,types:[5126]},rgba32uint:{gl:36208,rb:!0},rgba32sint:{gl:36226,rb:!0},rgba32float:{gl:34836,rb:!0,r:Ls},stencil8:{gl:36168,rb:!0},depth16unorm:{gl:33189,dataFormat:6402,types:[5123],rb:!0},depth24plus:{gl:33190,dataFormat:6402,types:[5125]},depth32float:{gl:36012,dataFormat:6402,types:[5126],rb:!0},"depth24plus-stencil8":{gl:35056,rb:!0,depthTexture:!0,dataFormat:34041,types:[34042]},"depth32float-stencil8":{gl:36013,dataFormat:34041,types:[36269],rb:!0},"bc1-rgb-unorm-webgl":{gl:33776,x:Cn},"bc1-rgb-unorm-srgb-webgl":{gl:35916,x:Ln},"bc1-rgba-unorm":{gl:33777,x:Cn},"bc1-rgba-unorm-srgb":{gl:35916,x:Ln},"bc2-rgba-unorm":{gl:33778,x:Cn},"bc2-rgba-unorm-srgb":{gl:35918,x:Ln},"bc3-rgba-unorm":{gl:33779,x:Cn},"bc3-rgba-unorm-srgb":{gl:35919,x:Ln},"bc4-r-unorm":{gl:36283,x:Bi},"bc4-r-snorm":{gl:36284,x:Bi},"bc5-rg-unorm":{gl:36285,x:Bi},"bc5-rg-snorm":{gl:36286,x:Bi},"bc6h-rgb-ufloat":{gl:36495,x:Di},"bc6h-rgb-float":{gl:36494,x:Di},"bc7-rgba-unorm":{gl:36492,x:Di},"bc7-rgba-unorm-srgb":{gl:36493,x:Di},"etc2-rgb8unorm":{gl:37492},"etc2-rgb8unorm-srgb":{gl:37494},"etc2-rgb8a1unorm":{gl:37496},"etc2-rgb8a1unorm-srgb":{gl:37497},"etc2-rgba8unorm":{gl:37493},"etc2-rgba8unorm-srgb":{gl:37495},"eac-r11unorm":{gl:37488},"eac-r11snorm":{gl:37489},"eac-rg11unorm":{gl:37490},"eac-rg11snorm":{gl:37491},"astc-4x4-unorm":{gl:37808},"astc-4x4-unorm-srgb":{gl:37840},"astc-5x4-unorm":{gl:37809},"astc-5x4-unorm-srgb":{gl:37841},"astc-5x5-unorm":{gl:37810},"astc-5x5-unorm-srgb":{gl:37842},"astc-6x5-unorm":{gl:37811},"astc-6x5-unorm-srgb":{gl:37843},"astc-6x6-unorm":{gl:37812},"astc-6x6-unorm-srgb":{gl:37844},"astc-8x5-unorm":{gl:37813},"astc-8x5-unorm-srgb":{gl:37845},"astc-8x6-unorm":{gl:37814},"astc-8x6-unorm-srgb":{gl:37846},"astc-8x8-unorm":{gl:37815},"astc-8x8-unorm-srgb":{gl:37847},"astc-10x5-unorm":{gl:37816},"astc-10x5-unorm-srgb":{gl:37848},"astc-10x6-unorm":{gl:37817},"astc-10x6-unorm-srgb":{gl:37849},"astc-10x8-unorm":{gl:37818},"astc-10x8-unorm-srgb":{gl:37850},"astc-10x10-unorm":{gl:37819},"astc-10x10-unorm-srgb":{gl:37851},"astc-12x10-unorm":{gl:37820},"astc-12x10-unorm-srgb":{gl:37852},"astc-12x12-unorm":{gl:37821},"astc-12x12-unorm-srgb":{gl:37853},"pvrtc-rgb4unorm-webgl":{gl:35840},"pvrtc-rgba4unorm-webgl":{gl:35842},"pvrtc-rgb2unorm-webgl":{gl:35841},"pvrtc-rgba2unorm-webgl":{gl:35843},"etc1-rbg-unorm-webgl":{gl:36196},"atc-rgb-unorm-webgl":{gl:35986},"atc-rgba-unorm-webgl":{gl:35986},"atc-rgbai-unorm-webgl":{gl:34798}};function CT(i,e,t){let n=e.create;const s=so[e.format];s?.gl===void 0&&(n=!1),s?.x&&(n=n&&!!hi(i,s.x,t)),e.format==="stencil8"&&(n=!1);const r=s?.r===!1?!1:s?.r===void 0||dm(i,s.r,t),o=n&&e.render&&r&&LT(i,e.format,t);return{format:e.format,create:n&&e.create,render:o,filter:n&&e.filter,blend:n&&e.blend,store:n&&e.store}}function LT(i,e,t){const n=so[e],s=n?.gl;if(s===void 0||n?.x&&!hi(i,n.x,t))return!1;const r=i.getParameter(32873),o=i.getParameter(36006),a=i.createTexture(),c=i.createFramebuffer();if(!a||!c)return!1;const l=0;let u=Number(i.getError());for(;u!==l;)u=i.getError();let f=!1;try{if(i.bindTexture(3553,a),i.texStorage2D(3553,1,s,1,1),Number(i.getError())!==l)return!1;i.bindFramebuffer(36160,c),i.framebufferTexture2D(36160,36064,3553,a,0),f=Number(i.checkFramebufferStatus(36160))===36053&&Number(i.getError())===l}finally{i.bindFramebuffer(36160,o),i.deleteFramebuffer(c),i.bindTexture(3553,r),i.deleteTexture(a)}return f}function gm(i){const e=so[i],t=MT(i),n=Ze.getInfo(i);return n.compressed&&(e.dataFormat=t),{internalFormat:t,format:e?.dataFormat||AT(n.channels,n.integer,n.normalized,t),type:n.dataType?um(n.dataType):e?.types?.[0]||5121,compressed:n.compressed||!1}}function TT(i){switch(Ze.getInfo(i).attachment){case"depth":return 36096;case"stencil":return 36128;case"depth-stencil":return 33306;default:throw new Error(`Not a depth stencil format: ${i}`)}}function AT(i,e,t,n){if(n===6408||n===6407)return n;switch(i){case"r":return e&&!t?36244:6403;case"rg":return e&&!t?33320:33319;case"rgb":return e&&!t?36248:6407;case"rgba":return e&&!t?36249:6408;case"bgra":throw new Error("bgra pixels not supported by WebGL");default:return 6408}}function MT(i){const t=so[i]?.gl;if(t===void 0)throw new Error(`Unsupported texture format ${i}`);return t}const Md={"depth-clip-control":"EXT_depth_clamp","timestamp-query":"EXT_disjoint_timer_query_webgl2","compilation-status-async-webgl":"KHR_parallel_shader_compile","html-in-canvas":i=>K0()&&typeof i.texElementImage2D=="function","polygon-mode-webgl":"WEBGL_polygon_mode","provoking-vertex-webgl":"WEBGL_provoking_vertex","shader-clip-cull-distance-webgl":"WEBGL_clip_cull_distance","shader-noperspective-interpolation-webgl":"NV_shader_noperspective_interpolation","shader-conservative-depth-webgl":"EXT_conservative_depth"};class IT extends X0{gl;extensions;testedFeatures=new Set;constructor(e,t,n){super([],n),this.gl=e,this.extensions=t,hi(e,"EXT_color_buffer_float",t)}*[Symbol.iterator](){const e=this.getFeatures();for(const t of e)this.has(t)&&(yield t);return[]}has(e){return this.disabledFeatures?.[e]?!1:(this.testedFeatures.has(e)||(this.testedFeatures.add(e),ET(e)&&dm(this.gl,e,this.extensions)&&this.features.add(e),this.getWebGLFeature(e)&&this.features.add(e)),this.features.has(e))}initializeFeatures(){const e=this.getFeatures().filter(t=>t!=="polygon-mode-webgl");for(const t of e)this.has(t)}getFeatures(){return[...Object.keys(Md),...Object.keys(Hl)]}getWebGLFeature(e){const t=Md[e];return typeof t=="string"?!!hi(this.gl,t,this.extensions):typeof t=="function"?t(this.gl):!!t}}class RT extends W0{get maxTextureDimension1D(){return 0}get maxTextureDimension2D(){return this.getParameter(3379)}get maxTextureDimension3D(){return this.getParameter(32883)}get maxTextureArrayLayers(){return this.getParameter(35071)}get maxBindGroups(){return 0}get maxBindGroupsPlusVertexBuffers(){return 0}get maxBindingsPerBindGroup(){return 0}get maxDynamicUniformBuffersPerPipelineLayout(){return 0}get maxDynamicStorageBuffersPerPipelineLayout(){return 0}get maxSampledTexturesPerShaderStage(){return this.getParameter(35660)}get maxSamplersPerShaderStage(){return this.getParameter(35661)}get maxStorageBuffersPerShaderStage(){return 0}get maxStorageBuffersInVertexStage(){return 0}get maxStorageBuffersInFragmentStage(){return 0}get maxStorageTexturesPerShaderStage(){return 0}get maxStorageTexturesInVertexStage(){return 0}get maxStorageTexturesInFragmentStage(){return 0}get maxUniformBuffersPerShaderStage(){return this.getParameter(35375)}get maxUniformBufferBindingSize(){return this.getParameter(35376)}get maxStorageBufferBindingSize(){return 0}get maxBufferSize(){return Number.MAX_SAFE_INTEGER}get minUniformBufferOffsetAlignment(){return this.getParameter(35380)}get minStorageBufferOffsetAlignment(){return 0}get maxVertexBuffers(){return 16}get maxVertexAttributes(){return this.getParameter(34921)}get maxVertexBufferArrayStride(){return 2048}get maxInterStageShaderVariables(){return this.getParameter(35659)}get maxColorAttachments(){return this.getParameter(36063)}get maxColorAttachmentBytesPerSample(){return 0}get maxComputeWorkgroupStorageSize(){return 0}get maxComputeInvocationsPerWorkgroup(){return 0}get maxComputeWorkgroupSizeX(){return 0}get maxComputeWorkgroupSizeY(){return 0}get maxComputeWorkgroupSizeZ(){return 0}get maxComputeWorkgroupsPerDimension(){return 0}gl;limits={};constructor(e){super(),this.gl=e}getParameter(e){return this.limits[e]===void 0&&(this.limits[e]=this.gl.getParameter(e)),this.limits[e]||0}}class kn extends Zr{device;gl;handle;colorAttachments=[];depthStencilAttachment=null;constructor(e,t){super(e,t);const n=t.handle,s=n===null;this.device=e,this.gl=e.gl,this.handle=n||s?n:this.gl.createFramebuffer(),s||(e._setWebGLDebugMetadata(this.handle,this,{spector:this.props}),t.handle||(this.autoCreateAttachmentTextures(),this.updateAttachments()))}destroy(){super.destroy(),!this.destroyed&&this.handle!==null&&!this.props.handle&&this.gl.deleteFramebuffer(this.handle)}updateAttachments(){const e=this.gl.bindFramebuffer(36160,this.handle);for(let t=0;t<this.colorAttachments.length;++t){const n=this.colorAttachments[t];if(n){const s=36064+t;this._attachTextureView(s,n)}}if(this.depthStencilAttachment){const t=TT(this.depthStencilAttachment.props.format);this._attachTextureView(t,this.depthStencilAttachment)}if(this.device.props.debug){const t=this.gl.checkFramebufferStatus(36160);if(t!==36053)throw new Error(`Framebuffer ${kT(t)}`)}this.gl.bindFramebuffer(36160,e)}_attachTextureView(e,t){const{gl:n}=this.device,{texture:s}=t,r=t.props.baseMipLevel,o=t.props.baseArrayLayer;switch(n.bindTexture(s.glTarget,s.handle),s.glTarget){case 35866:case 32879:n.framebufferTextureLayer(36160,e,s.handle,r,o);break;case 34067:const a=OT(o);n.framebufferTexture2D(36160,e,a,s.handle,r);break;case 3553:n.framebufferTexture2D(36160,e,3553,s.handle,r);break;default:throw new Error("Illegal texture type")}n.bindTexture(s.glTarget,null)}resizeAttachments(e,t){if(this.handle===null){this.width=e,this.height=t;return}super.resizeAttachments(e,t)}}function OT(i){return i<34069?i+34069:i}function kT(i){switch(i){case 36053:return"success";case 36054:return"Mismatched attachments";case 36055:return"No attachments";case 36057:return"Height/width mismatch";case 36061:return"Unsupported or split attachments";case 36182:return"Samples mismatch";default:return`${i}`}}class BT extends sx{device;handle=null;_framebuffer=null;get[Symbol.toStringTag](){return"WebGLCanvasContext"}constructor(e,t){super(t),this.device=e,this._setAutoCreatedCanvasId(`${this.device.id}-canvas`),this._configureDevice()}_configureDevice(){(this.drawingBufferWidth!==this._framebuffer?.width||this.drawingBufferHeight!==this._framebuffer?.height)&&this._framebuffer?.resize([this.drawingBufferWidth,this.drawingBufferHeight])}_getCurrentFramebuffer(){return this._framebuffer||=new kn(this.device,{id:"canvas-context-framebuffer",handle:null,width:this.drawingBufferWidth,height:this.drawingBufferHeight}),this._framebuffer}}class DT extends rx{device;handle=null;context2d;get[Symbol.toStringTag](){return"WebGLPresentationContext"}constructor(e,t={}){super(t),this.device=e;const n=`${this[Symbol.toStringTag]}(${this.id})`;if(!this.device.getDefaultCanvasContext().offscreenCanvas)throw new Error(`${n}: WebGL PresentationContext requires the default CanvasContext canvas to be an OffscreenCanvas`);const r=this.canvas.getContext("2d");if(!r)throw new Error(`${n}: Failed to create 2d presentation context`);this.context2d=r,this._setAutoCreatedCanvasId(`${this.device.id}-presentation-canvas`),this._configureDevice(),this._startObservers()}present(){this._resizeDrawingBufferIfNeeded(),this.device.submit();const e=this.device.getDefaultCanvasContext(),[t,n]=e.getDrawingBufferSize();if(!(this.drawingBufferWidth===0||this.drawingBufferHeight===0||t===0||n===0||e.canvas.width===0||e.canvas.height===0)){if(t!==this.drawingBufferWidth||n!==this.drawingBufferHeight||e.canvas.width!==this.drawingBufferWidth||e.canvas.height!==this.drawingBufferHeight)throw new Error(`${this[Symbol.toStringTag]}(${this.id}): Default canvas context size ${t}x${n} does not match presentation size ${this.drawingBufferWidth}x${this.drawingBufferHeight}`);this.context2d.clearRect(0,0,this.drawingBufferWidth,this.drawingBufferHeight),this.context2d.drawImage(e.canvas,0,0)}}_configureDevice(){}_getCurrentFramebuffer(e){const t=this.device.getDefaultCanvasContext();return t.setDrawingBufferSize(this.drawingBufferWidth,this.drawingBufferHeight),t.getCurrentFramebuffer(e)}}const ga={};function FT(i="id"){ga[i]=ga[i]||1;const e=ga[i]++;return`${i}-${e}`}class Bn extends q{device;gl;handle;glTarget;glUsage;glIndexType=5123;byteLength=0;bytesUsed=0;constructor(e,t={}){super(e,t),this.device=e,this.gl=this.device.gl;const n=typeof t=="object"?t.handle:void 0;this.handle=n||this.gl.createBuffer(),e._setWebGLDebugMetadata(this.handle,this,{spector:{...this.props,data:typeof this.props.data}}),this.glTarget=zT(this.props.usage),this.glUsage=NT(this.props.usage),this.glIndexType=this.props.indexType==="uint32"?5125:5123,t.data?this._initWithData(t.data,t.byteOffset,t.byteLength):this._initWithByteLength(t.byteLength||0)}destroy(){!this.destroyed&&this.handle&&(this.removeStats(),this.props.handle?this.trackDeallocatedReferencedMemory("Buffer"):(this.trackDeallocatedMemory(),this.gl.deleteBuffer(this.handle)),this.destroyed=!0,this.handle=null)}_initWithData(e,t=0,n=e.byteLength+t){const s=this.glTarget;this.gl.bindBuffer(s,this.handle),this.gl.bufferData(s,n,this.glUsage),this.gl.bufferSubData(s,t,e),this.gl.bindBuffer(s,null),this.bytesUsed=n,this.byteLength=n,this._setDebugData(e,t,n),this.props.handle?this.trackReferencedMemory(n,"Buffer"):this.trackAllocatedMemory(n)}_initWithByteLength(e){let t=e;e===0&&(t=new Float32Array(0));const n=this.glTarget;return this.gl.bindBuffer(n,this.handle),this.gl.bufferData(n,t,this.glUsage),this.gl.bindBuffer(n,null),this.bytesUsed=e,this.byteLength=e,this._setDebugData(null,0,e),this.props.handle?this.trackReferencedMemory(e,"Buffer"):this.trackAllocatedMemory(e),this}write(e,t=0){const n=ArrayBuffer.isView(e)?e:new Uint8Array(e),s=36663;this.gl.bindBuffer(s,this.handle),this.gl.bufferSubData(s,t,n),this.gl.bindBuffer(s,null),this._setDebugData(e,t,e.byteLength)}async mapAndWriteAsync(e,t=0,n=this.byteLength-t){const s=new ArrayBuffer(n);await e(s,"copied"),this.write(s,t)}async readAsync(e=0,t){return this.readSyncWebGL(e,t)}async mapAndReadAsync(e,t=0,n){const s=await this.readAsync(t,n);return await e(s.buffer,"copied")}readSyncWebGL(e=0,t){t=t??this.byteLength-e;const n=new Uint8Array(t),s=0;return this.gl.bindBuffer(36662,this.handle),this.gl.getBufferSubData(36662,e,n,s,t),this.gl.bindBuffer(36662,null),this._setDebugData(n,e,t),n}}function zT(i){return i&q.INDEX?34963:i&q.VERTEX?34962:i&q.UNIFORM?35345:34962}function NT(i){return i&q.INDEX||i&q.VERTEX?35044:i&q.UNIFORM?35048:35044}function UT(i){const e=i.split(/\r?\n/),t=[];for(const n of e){if(n.length<=1)continue;const s=n.trim(),r=n.split(":"),o=r[0]?.trim();if(r.length===2){const[h,g]=r;if(!h||!g){t.push({message:s,type:Ts(o||"info"),lineNum:0,linePos:0});continue}t.push({message:g.trim(),type:Ts(h),lineNum:0,linePos:0});continue}const[a,c,l,...u]=r;if(!a||!c||!l){t.push({message:r.slice(1).join(":").trim()||s,type:Ts(o||"info"),lineNum:0,linePos:0});continue}let f=parseInt(l,10);Number.isNaN(f)&&(f=0);let d=parseInt(c,10);Number.isNaN(d)&&(d=0),t.push({message:u.join(":").trim(),type:Ts(a),lineNum:f,linePos:d})}return t}function Ts(i){const e=["warning","error","info"],t=i.toLowerCase();return e.includes(t)?t:"info"}class $T extends qr{device;handle;_compilationInfoLog="";constructor(e,t){super(e,t),this.device=e;const n=this.props.handle;switch(this.props.stage){case"vertex":this.handle=n||this.device.gl.createShader(35633);break;case"fragment":this.handle=n||this.device.gl.createShader(35632);break;default:throw new Error(this.props.stage)}e._setWebGLDebugMetadata(this.handle,this,{spector:this.props});const s=this._compile(this.source);s&&typeof s.catch=="function"&&s.catch(()=>{this.compilationStatus="error"})}destroy(){this.handle&&(this.removeStats(),this.device.gl.deleteShader(this.handle),this.destroyed=!0,this.handle.destroyed=!0)}get asyncCompilationStatus(){return this._waitForCompilationComplete().then(()=>(this._getCompilationStatus(),this.compilationStatus))}async getCompilationInfo(){return await this._waitForCompilationComplete(),this.getCompilationInfoSync()}getCompilationInfoSync(){const e=this._getCompilationInfoLog();return e?UT(e):[]}getTranslatedSource(){return this.device.getExtension("WEBGL_debug_shaders").WEBGL_debug_shaders?.getTranslatedShaderSource(this.handle)||null}_compile(e){e=e.startsWith("#version ")?e:`#version 300 es
${e}`;const{gl:t}=this.device;if(t.shaderSource(this.handle,e),t.compileShader(this.handle),!this.device.props.debug){this.compilationStatus="pending";return}if(!this.device.features.has("compilation-status-async-webgl")){if(this._getCompilationStatus(),this.debugShader(),this.compilationStatus==="error")throw new Error(this._getCompilationErrorMessage(e));return}return A.once(1,"Shader compilation is asynchronous")(),this._waitForCompilationComplete().then(()=>{A.info(2,`Shader ${this.id} - async compilation complete: ${this.compilationStatus}`)(),this._getCompilationStatus(),this.debugShader()})}async _waitForCompilationComplete(){const e=async s=>await new Promise(r=>setTimeout(r,s));if(!this.device.features.has("compilation-status-async-webgl")){await e(10);return}const{gl:n}=this.device;for(;;){if(n.getShaderParameter(this.handle,37297))return;await e(10)}}_getCompilationStatus(){this.compilationStatus=this.device.gl.getShaderParameter(this.handle,35713)?"success":"error",this.compilationStatus==="error"&&this._getCompilationInfoLog()}_getCompilationErrorMessage(e){const t=`${this.props.stage} shader ${this.props.id}`,n=GT(this._getCompilationInfoLog()),s=this.getCompilationInfoSync(),r=s.find(u=>u.type==="error"&&u.message.trim())||s.find(u=>u.message.trim())||s.find(u=>u.type==="error")||s[0];if(!r)return n?`GLSL compilation errors in ${t}: ${n}`:`GLSL compilation errors in ${t}: WebGL did not provide a shader compiler log`;const o=r.lineNum?e.split(/\r?\n/)[r.lineNum-1]?.trim():void 0,a=r.lineNum?` line ${r.lineNum}`:"",c=o?`
Source: ${o}`:"",l=r.message.trim()||n||"WebGL did not provide a shader compiler log";return`GLSL compilation errors in ${t}:${a}: ${l}${c}`}_getCompilationInfoLog(){const e=this.device.gl.getShaderInfoLog(this.handle)?.trim();return e&&(this._compilationInfoLog=e),this._compilationInfoLog}}function GT(i){return i.split(/\r?\n/).find(e=>e.trim())?.trim()}function VT(i,e,t,n){if(YT(e))return n(i);const s=i;s.pushState();try{return jT(i,e),cn(s.gl,t),n(i)}finally{s.popState()}}function jT(i,e){const t=i,{gl:n}=t;if(e.cullMode)switch(e.cullMode){case"none":n.disable(2884);break;case"front":n.enable(2884),n.cullFace(1028);break;case"back":n.enable(2884),n.cullFace(1029);break}if(e.frontFace&&n.frontFace(oi("frontFace",e.frontFace,{ccw:2305,cw:2304})),e.unclippedDepth&&i.features.has("depth-clip-control")&&n.enable(34383),e.depthBias!==void 0&&(n.enable(32823),n.polygonOffset(e.depthBias,e.depthBiasSlopeScale||0)),e.provokingVertex&&i.features.has("provoking-vertex-webgl")){const r=t.getExtension("WEBGL_provoking_vertex").WEBGL_provoking_vertex,o=oi("provokingVertex",e.provokingVertex,{first:36429,last:36430});r?.provokingVertexWEBGL(o)}if((e.polygonMode||e.polygonOffsetLine)&&i.features.has("polygon-mode-webgl")){if(e.polygonMode){const r=t.getExtension("WEBGL_polygon_mode").WEBGL_polygon_mode,o=oi("polygonMode",e.polygonMode,{fill:6914,line:6913});r?.polygonModeWEBGL(1028,o),r?.polygonModeWEBGL(1029,o)}e.polygonOffsetLine&&n.enable(10754)}if(i.features.has("shader-clip-cull-distance-webgl")&&(e.clipDistance0&&n.enable(12288),e.clipDistance1&&n.enable(12289),e.clipDistance2&&n.enable(12290),e.clipDistance3&&n.enable(12291),e.clipDistance4&&n.enable(12292),e.clipDistance5&&n.enable(12293),e.clipDistance6&&n.enable(12294),e.clipDistance7&&n.enable(12295)),e.depthWriteEnabled!==void 0&&n.depthMask(HT("depthWriteEnabled",e.depthWriteEnabled)),e.depthCompare&&(e.depthCompare!=="always"?n.enable(2929):n.disable(2929),n.depthFunc(Cc("depthCompare",e.depthCompare))),e.clearDepth!==void 0&&n.clearDepth(e.clearDepth),e.stencilWriteMask){const s=e.stencilWriteMask;n.stencilMaskSeparate(1028,s),n.stencilMaskSeparate(1029,s)}if(e.stencilReadMask&&A.warn("stencilReadMask not supported under WebGL"),e.stencilCompare){const s=e.stencilReadMask||4294967295,r=Cc("depthCompare",e.stencilCompare);e.stencilCompare!=="always"?n.enable(2960):n.disable(2960),n.stencilFuncSeparate(1028,r,0,s),n.stencilFuncSeparate(1029,r,0,s)}if(e.stencilPassOperation&&e.stencilFailOperation&&e.stencilDepthFailOperation){const s=pa("stencilPassOperation",e.stencilPassOperation),r=pa("stencilFailOperation",e.stencilFailOperation),o=pa("stencilDepthFailOperation",e.stencilDepthFailOperation);n.stencilOpSeparate(1028,r,o,s),n.stencilOpSeparate(1029,r,o,s)}switch(e.blend){case!0:n.enable(3042);break;case!1:n.disable(3042);break}if(e.blendColorOperation||e.blendAlphaOperation){const s=Id("blendColorOperation",e.blendColorOperation||"add"),r=Id("blendAlphaOperation",e.blendAlphaOperation||"add");n.blendEquationSeparate(s,r);const o=As("blendColorSrcFactor",e.blendColorSrcFactor||"one"),a=As("blendColorDstFactor",e.blendColorDstFactor||"zero"),c=As("blendAlphaSrcFactor",e.blendAlphaSrcFactor||"one"),l=As("blendAlphaDstFactor",e.blendAlphaDstFactor||"zero");n.blendFuncSeparate(o,a,c,l)}}function Cc(i,e){return oi(i,e,{never:512,less:513,equal:514,"less-equal":515,greater:516,"not-equal":517,"greater-equal":518,always:519})}function pa(i,e){return oi(i,e,{keep:7680,zero:0,replace:7681,invert:5386,"increment-clamp":7682,"decrement-clamp":7683,"increment-wrap":34055,"decrement-wrap":34056})}function Id(i,e){return oi(i,e,{add:32774,subtract:32778,"reverse-subtract":32779,min:32775,max:32776})}function As(i,e,t="color"){return oi(i,e,{one:1,zero:0,src:768,"one-minus-src":769,dst:774,"one-minus-dst":775,"src-alpha":770,"one-minus-src-alpha":771,"dst-alpha":772,"one-minus-dst-alpha":773,"src-alpha-saturated":776,constant:t==="color"?32769:32771,"one-minus-constant":t==="color"?32770:32772,src1:768,"one-minus-src1":769,"src1-alpha":770,"one-minus-src1-alpha":771})}function WT(i,e){return`Illegal parameter ${e} for ${i}`}function oi(i,e,t){if(!(e in t))throw new Error(WT(i,e));return t[e]}function HT(i,e){return e}function YT(i){let e=!0;for(const t in i){e=!1;break}return e}function pm(i){const e={};return i.addressModeU&&(e[10242]=ma(i.addressModeU)),i.addressModeV&&(e[10243]=ma(i.addressModeV)),i.addressModeW&&(e[32882]=ma(i.addressModeW)),i.magFilter&&(e[10240]=Lc(i.magFilter)),(i.minFilter||i.mipmapFilter)&&(e[10241]=qT(i.minFilter||"linear",i.mipmapFilter)),i.lodMinClamp!==void 0&&(e[33082]=i.lodMinClamp),i.lodMaxClamp!==void 0&&(e[33083]=i.lodMaxClamp),i.type==="comparison-sampler"&&(e[34892]=34894),i.compare&&(e[34893]=Cc("compare",i.compare)),i.maxAnisotropy&&(e[34046]=i.maxAnisotropy),e}function ma(i){switch(i){case"clamp-to-edge":return 33071;case"repeat":return 10497;case"mirror-repeat":return 33648}}function Lc(i){switch(i){case"nearest":return 9728;case"linear":return 9729}}function qT(i,e="none"){if(!e)return Lc(i);switch(e){case"none":return Lc(i);case"nearest":switch(i){case"nearest":return 9984;case"linear":return 9985}break;case"linear":switch(i){case"nearest":return 9986;case"linear":return 9987}}}class ZT extends Vn{device;handle;parameters;constructor(e,t){super(e,t),this.device=e,this.parameters=pm(t),this.handle=t.handle||this.device.gl.createSampler(),this._setSamplerParameters(this.parameters)}destroy(){this.handle&&(this.device.gl.deleteSampler(this.handle),this.handle=void 0)}toString(){return`Sampler(${this.id},${JSON.stringify(this.props)})`}_setSamplerParameters(e){for(const[t,n]of Object.entries(e)){const s=Number(t);switch(s){case 33082:case 33083:this.device.gl.samplerParameterf(this.handle,s,n);break;default:this.device.gl.samplerParameteri(this.handle,s,n);break}}}}function kt(i,e,t){if(XT(e))return t(i);const{nocatch:n=!0}=e,s=ri.get(i);s.push(),cn(i,e);let r;if(n)r=t(i),s.pop();else try{r=t(i)}finally{s.pop()}return r}function XT(i){for(const e in i)return!1;return!0}class Fi extends Yr{device;gl;handle;texture;constructor(e,t){super(e,{...re.defaultProps,...t}),this.device=e,this.gl=this.device.gl,this.handle=null,this.texture=t.texture}}function mm(i){return KT[i]}const KT={5124:"sint32",5125:"uint32",5122:"sint16",5123:"uint16",5120:"sint8",5121:"uint8",5126:"float32",5131:"float16",33635:"uint16",32819:"uint16",32820:"uint16",33640:"uint32",35899:"uint32",35902:"uint32",34042:"uint32",36269:"uint32"};class Dn extends re{device;gl;handle;sampler=void 0;view;glTarget;glFormat;glType;glInternalFormat;compressed;_textureUnit=0;_framebuffer=null;_framebufferAttachmentKey=null;constructor(e,t){super(e,t,{byteAlignment:1}),this.device=e,this.gl=this.device.gl;const n=gm(this.props.format);if(this.glTarget=e1(this.props.dimension),this.glInternalFormat=n.internalFormat,this.glFormat=n.format,this.glType=n.type,this.compressed=n.compressed,this.isHandleBorrowed&&this.props.handle===void 0)throw new Error("Borrowed WebGL textures require a texture handle");if(this.handle=this.props.handle||this.gl.createTexture(),this.device._setWebGLDebugMetadata(this.handle,this,{spector:this.props}),!this.isHandleBorrowed){this.gl.bindTexture(this.glTarget,this.handle);const{dimension:s,width:r,height:o,depth:a,mipLevels:c,glTarget:l,glInternalFormat:u}=this;if(!this.compressed)switch(s){case"2d":case"cube":this.gl.texStorage2D(l,c,u,r,o);break;case"2d-array":case"3d":this.gl.texStorage3D(l,c,u,r,o,a);break;default:throw new Error(s)}this.gl.bindTexture(this.glTarget,null),this._initializeData(t.data)}this.ownsHandle?this.trackAllocatedMemory(this.getAllocatedByteLength(),"Texture"):this.trackReferencedMemory(this.getAllocatedByteLength(),"Texture"),this.isHandleBorrowed||this.setSampler(this.props.sampler),this.view=new Fi(this.device,{...this.props,texture:this}),Object.seal(this)}destroy(){this.handle&&(this._framebuffer?.destroy(),this._framebuffer=null,this._framebufferAttachmentKey=null,this.removeStats(),this.ownsHandle?(this.gl.deleteTexture(this.handle),this.trackDeallocatedMemory("Texture")):this.trackDeallocatedReferencedMemory("Texture"),this.destroyed=!0)}createView(e){return new Fi(this.device,{...e,texture:this})}clone(e){if(this.isHandleBorrowed&&e&&(e.width!==this.width||e.height!==this.height))throw new Error(`Cannot resize borrowed read-only ${this}`);return super.clone(e)}setSampler(e={}){this._assertWritable("set sampler parameters on"),super.setSampler(e);const t=pm(this.sampler.props);this._setSamplerParameters(t)}copyExternalImage(e){this._assertWritable("copy external image data into");const t=this._normalizeCopyExternalImageOptions(e);if(t.sourceX||t.sourceY)throw new Error("WebGL does not support sourceX/sourceY)");const{glFormat:n,glType:s}=this,{image:r,depth:o,mipLevel:a,x:c,y:l,z:u,width:f,height:d}=t,h=pn(this.glTarget,this.dimension,u),g=t.flipY?{37440:!0}:{};return this.gl.bindTexture(this.glTarget,this.handle),kt(this.gl,g,()=>{switch(this.dimension){case"2d":case"cube":this.gl.texSubImage2D(h,a,c,l,f,d,n,s,r);break;case"2d-array":case"3d":this.gl.texSubImage3D(h,a,c,l,u,f,d,o,n,s,r);break;default:}}),this.gl.bindTexture(this.glTarget,null),{width:t.width,height:t.height}}copyElementImage(e){this._assertWritable("copy element image data into");const t=this._normalizeCopyElementImageOptions(e),{glFormat:n}=this,{element:s,depth:r,mipLevel:o,sourceX:a,sourceY:c,sourceWidth:l,sourceHeight:u,x:f,y:d,z:h,width:g,height:p}=t,m=pn(this.glTarget,this.dimension,h),_=t.flipY?{37440:!0}:{},v=this.gl;if(r!==1||this.dimension!=="2d"&&this.dimension!=="cube")throw new Error(`${this} copyElementImage only supports 2d and cube textures on WebGL`);if(o!==0||f!==0||d!==0)throw new Error(`${this} copyElementImage only supports full base-level uploads on WebGL`);if(typeof v.texElementImage2D!="function")throw new Error(`${this} copyElementImage is not supported by this WebGL implementation`);return this.gl.bindTexture(this.glTarget,this.handle),kt(this.gl,_,()=>{v.texElementImage2D?.(m,n,s,{sx:a,sy:c,swidth:l??g,sheight:u??p,width:g,height:p})}),this.gl.bindTexture(this.glTarget,null),{width:t.width,height:t.height}}copyImageData(e){super.copyImageData(e)}readBuffer(e={},t){if(!t)throw new Error(`${this} readBuffer requires a destination buffer`);const n=this._getSupportedColorReadOptions(e),s=e.byteOffset??0,r=this.computeMemoryLayout(n);if(t.byteLength<s+r.byteLength)throw new Error(`${this} readBuffer target is too small (${t.byteLength} < ${s+r.byteLength})`);const o=t;this.gl.bindBuffer(35051,o.handle);try{this._readColorTextureLayers(n,r,a=>{this.gl.readPixels(n.x,n.y,n.width,n.height,this.glFormat,this.glType,s+a)})}finally{this.gl.bindBuffer(35051,null)}return t}async readDataAsync(e={}){throw new Error(`${this} readDataAsync is deprecated; use readBuffer() with an explicit destination buffer or DynamicTexture.readAsync()`)}writeBuffer(e,t={}){this._assertWritable("write buffer data into");const n=this._normalizeTextureWriteOptions(t),{width:s,height:r,depthOrArrayLayers:o,mipLevel:a,byteOffset:c,x:l,y:u,z:f}=n,{glFormat:d,glType:h,compressed:g}=this,p=pn(this.glTarget,this.dimension,f);if(g)throw new Error("writeBuffer for compressed textures is not implemented in WebGL");const{bytesPerPixel:m}=this.device.getTextureFormatInfo(this.format),_=m?n.bytesPerRow/m:void 0,v={3317:this.byteAlignment,..._!==void 0?{3314:_}:{},32878:n.rowsPerImage};this.gl.bindTexture(this.glTarget,this.handle),this.gl.bindBuffer(35052,e.handle),kt(this.gl,v,()=>{switch(this.dimension){case"2d":case"cube":this.gl.texSubImage2D(p,a,l,u,s,r,d,h,c);break;case"2d-array":case"3d":this.gl.texSubImage3D(p,a,l,u,f,s,r,o,d,h,c);break;default:}}),this.gl.bindBuffer(35052,null),this.gl.bindTexture(this.glTarget,null)}writeData(e,t={}){this._assertWritable("write data into");const n=this._normalizeTextureWriteOptions(t),s=ArrayBuffer.isView(e)?e:new Uint8Array(e),{width:r,height:o,depthOrArrayLayers:a,mipLevel:c,x:l,y:u,z:f,byteOffset:d}=n,{glFormat:h,glType:g,compressed:p}=this,m=pn(this.glTarget,this.dimension,f);let _;if(!p){const{bytesPerPixel:B}=this.device.getTextureFormatInfo(this.format);B&&(_=n.bytesPerRow/B)}const v=this.compressed?{}:{3317:this.byteAlignment,..._!==void 0?{3314:_}:{},32878:n.rowsPerImage},b=JT(s,d),x=p?QT(s,d):s,w=this._getMipLevelSize(c),C=l===0&&u===0&&f===0&&r===w.width&&o===w.height&&a===w.depthOrArrayLayers;this.gl.bindTexture(this.glTarget,this.handle),this.gl.bindBuffer(35052,null),kt(this.gl,v,()=>{switch(this.dimension){case"2d":case"cube":p?C?this.gl.compressedTexImage2D(m,c,h,r,o,0,x):this.gl.compressedTexSubImage2D(m,c,l,u,r,o,h,x):this.gl.texSubImage2D(m,c,l,u,r,o,h,g,s,b);break;case"2d-array":case"3d":p?C?this.gl.compressedTexImage3D(m,c,h,r,o,a,0,x):this.gl.compressedTexSubImage3D(m,c,l,u,f,r,o,a,h,x):this.gl.texSubImage3D(m,c,l,u,f,r,o,a,h,g,s,b);break;default:}}),this.gl.bindTexture(this.glTarget,null)}_getRowByteAlignment(e,t){return 1}_getFramebuffer(){return this._framebuffer||=this.device.createFramebuffer({id:`framebuffer-for-${this.id}`,width:this.width,height:this.height,colorAttachments:[this]}),this._framebuffer}readDataSyncWebGL(e={}){const t=this._getSupportedColorReadOptions(e),n=this.computeMemoryLayout(t),s=mm(this.glType),r=el(s),o=new r(n.byteLength/r.BYTES_PER_ELEMENT);return this._readColorTextureLayers(t,n,a=>{const c=new r(o.buffer,o.byteOffset+a,n.bytesPerImage/r.BYTES_PER_ELEMENT);this.gl.readPixels(t.x,t.y,t.width,t.height,this.glFormat,this.glType,c)}),o.buffer}_readColorTextureLayers(e,t,n){const s=this._getFramebuffer(),r=t.bytesPerRow/t.bytesPerPixel,o={3333:this.byteAlignment,...r!==e.width?{3330:r}:{}},a=this.gl.getParameter(3074),c=this.gl.bindFramebuffer(36160,s.handle);try{this.gl.readBuffer(36064),kt(this.gl,o,()=>{for(let l=0;l<e.depthOrArrayLayers;l++)this._attachReadSubresource(s,e.mipLevel,e.z+l),n(l*t.bytesPerImage)})}finally{this.gl.bindFramebuffer(36160,c||null),this.gl.readBuffer(a)}}_attachReadSubresource(e,t,n){const s=`${t}:${n}`;if(this._framebufferAttachmentKey!==s){switch(this.dimension){case"2d":this.gl.framebufferTexture2D(36160,36064,3553,this.handle,t);break;case"cube":this.gl.framebufferTexture2D(36160,36064,pn(this.glTarget,this.dimension,n),this.handle,t);break;case"2d-array":case"3d":this.gl.framebufferTextureLayer(36160,36064,this.handle,t,n);break;default:throw new Error(`${this} color readback does not support ${this.dimension} textures`)}if(this.device.props.debug){const r=Number(this.gl.checkFramebufferStatus(36160));if(r!==36053)throw new Error(`${e} incomplete for ${this} readback (${r})`)}this._framebufferAttachmentKey=s}}generateMipmapsWebGL(e){if(this._assertWritable("generate mipmaps for"),!(!(this.device.isTextureFormatRenderable(this.props.format)&&this.device.isTextureFormatFilterable(this.props.format))&&(A.warn(`${this} is not renderable or filterable, may not be able to generate mipmaps`)(),!e?.force)))try{this.gl.bindTexture(this.glTarget,this.handle),this.gl.generateMipmap(this.glTarget)}catch(n){A.warn(`Error generating mipmap for ${this}: ${n.message}`)()}finally{this.gl.bindTexture(this.glTarget,null)}}_setSamplerParameters(e){A.log(2,`${this.id} sampler parameters`,this.device.getGLKeys(e))(),this.gl.bindTexture(this.glTarget,this.handle);for(const[t,n]of Object.entries(e)){const s=Number(t),r=n;switch(s){case 33082:case 33083:this.gl.texParameterf(this.glTarget,s,r);break;case 10240:case 10241:this.gl.texParameteri(this.glTarget,s,r);break;case 10242:case 10243:case 32882:this.gl.texParameteri(this.glTarget,s,r);break;case 34046:this.device.features.has("texture-filterable-anisotropic-webgl")&&this.gl.texParameteri(this.glTarget,s,r);break;case 34892:case 34893:this.gl.texParameteri(this.glTarget,s,r);break}}this.gl.bindTexture(this.glTarget,null)}_getActiveUnit(){return this.gl.getParameter(34016)-33984}_bind(e){const{gl:t}=this;return e!==void 0&&(this._textureUnit=e,t.activeTexture(33984+e)),t.bindTexture(this.glTarget,this.handle),e}_unbind(e){const{gl:t}=this;return e!==void 0&&(this._textureUnit=e,t.activeTexture(33984+e)),t.bindTexture(this.glTarget,null),e}_assertWritable(e){if(this.isHandleBorrowed)throw new Error(`Cannot ${e} borrowed read-only ${this}`)}}function QT(i,e=0){return e?new i.constructor(i.buffer,i.byteOffset+e,(i.byteLength-e)/i.BYTES_PER_ELEMENT):i}function JT(i,e){if(e%i.BYTES_PER_ELEMENT!==0)throw new Error(`Texture byteOffset ${e} must align to typed array element size ${i.BYTES_PER_ELEMENT}`);return e/i.BYTES_PER_ELEMENT}function e1(i){switch(i){case"1d":break;case"2d":return 3553;case"3d":return 32879;case"cube":return 34067;case"2d-array":return 35866}throw new Error(i)}function pn(i,e,t){return e==="cube"?34069+t:i}function t1(i,e,t,n){const s=i;let r=n;r===!0&&(r=1),r===!1&&(r=0);const o=typeof r=="number"?[r]:r;switch(t){case 35678:case 35680:case 35679:case 35682:case 36289:case 36292:case 36293:case 36298:case 36299:case 36300:case 36303:case 36306:case 36307:case 36308:case 36311:if(typeof n!="number")throw new Error("samplers must be set to integers");return i.uniform1i(e,n);case 5126:return i.uniform1fv(e,o);case 35664:return i.uniform2fv(e,o);case 35665:return i.uniform3fv(e,o);case 35666:return i.uniform4fv(e,o);case 5124:return i.uniform1iv(e,o);case 35667:return i.uniform2iv(e,o);case 35668:return i.uniform3iv(e,o);case 35669:return i.uniform4iv(e,o);case 35670:return i.uniform1iv(e,o);case 35671:return i.uniform2iv(e,o);case 35672:return i.uniform3iv(e,o);case 35673:return i.uniform4iv(e,o);case 5125:return s.uniform1uiv(e,o,1);case 36294:return s.uniform2uiv(e,o,2);case 36295:return s.uniform3uiv(e,o,3);case 36296:return s.uniform4uiv(e,o,4);case 35674:return i.uniformMatrix2fv(e,!1,o);case 35675:return i.uniformMatrix3fv(e,!1,o);case 35676:return i.uniformMatrix4fv(e,!1,o);case 35685:return s.uniformMatrix2x3fv(e,!1,o);case 35686:return s.uniformMatrix2x4fv(e,!1,o);case 35687:return s.uniformMatrix3x2fv(e,!1,o);case 35688:return s.uniformMatrix3x4fv(e,!1,o);case 35689:return s.uniformMatrix4x2fv(e,!1,o);case 35690:return s.uniformMatrix4x3fv(e,!1,o)}throw new Error("Illegal uniform")}function i1(i){return r1[i]}function Yl(i){return s1[i]}function ym(i){return!!_m[i]}function n1(i){return _m[i]}const s1={5126:"f32",35664:"vec2<f32>",35665:"vec3<f32>",35666:"vec4<f32>",5124:"i32",35667:"vec2<i32>",35668:"vec3<i32>",35669:"vec4<i32>",5125:"u32",36294:"vec2<u32>",36295:"vec3<u32>",36296:"vec4<u32>",35670:"f32",35671:"vec2<f32>",35672:"vec3<f32>",35673:"vec4<f32>",35674:"mat2x2<f32>",35685:"mat2x3<f32>",35686:"mat2x4<f32>",35687:"mat3x2<f32>",35675:"mat3x3<f32>",35688:"mat3x4<f32>",35689:"mat4x2<f32>",35690:"mat4x3<f32>",35676:"mat4x4<f32>"},_m={35678:{viewDimension:"2d",sampleType:"float"},35680:{viewDimension:"cube",sampleType:"float"},35679:{viewDimension:"3d",sampleType:"float"},35682:{viewDimension:"3d",sampleType:"depth"},36289:{viewDimension:"2d-array",sampleType:"float"},36292:{viewDimension:"2d-array",sampleType:"depth"},36293:{viewDimension:"cube",sampleType:"float"},36298:{viewDimension:"2d",sampleType:"sint"},36299:{viewDimension:"3d",sampleType:"sint"},36300:{viewDimension:"cube",sampleType:"sint"},36303:{viewDimension:"2d-array",sampleType:"uint"},36306:{viewDimension:"2d",sampleType:"uint"},36307:{viewDimension:"3d",sampleType:"uint"},36308:{viewDimension:"cube",sampleType:"uint"},36311:{viewDimension:"2d-array",sampleType:"uint"}},r1={uint8:5121,sint8:5120,unorm8:5121,snorm8:5120,uint16:5123,sint16:5122,unorm16:5123,snorm16:5122,uint32:5125,sint32:5124,float16:5131,float32:5126};function o1(i,e,t={}){const n={attributes:[],bindings:[]};n.attributes=a1(i,e);const s=u1(i,e,t);for(const c of s){const l=c.uniforms.map(u=>({name:u.name,format:u.format,byteOffset:u.byteOffset,byteStride:u.byteStride,arrayLength:u.arrayLength}));n.bindings.push({type:"uniform",name:c.name,group:0,location:c.location,visibility:(c.vertex?1:0)|(c.fragment?2:0),minBindingSize:c.byteLength,uniforms:l})}const r=l1(i,e);let o=0;for(const c of r)if(ym(c.type)){const{viewDimension:l,sampleType:u}=n1(c.type);n.bindings.push({type:"texture",name:c.name,group:0,location:o,viewDimension:l,sampleType:u}),c.textureUnit=o,o+=1}r.length&&(n.uniforms=r);const a=c1(i,e);return a?.length&&(n.varyings=a),n}function a1(i,e){const t=[],n=i.getProgramParameter(e,35721);for(let s=0;s<n;s++){const r=i.getActiveAttrib(e,s);if(!r)throw new Error("activeInfo");const{name:o,type:a}=r,c=i.getAttribLocation(e,o);if(c>=0){const l=Yl(a),u=/instance/i.test(o)?"instance":"vertex";t.push({name:o,location:c,stepMode:u,type:l})}}return t.sort((s,r)=>s.location-r.location),t}function c1(i,e){const t=[],n=i.getProgramParameter(e,35971);for(let s=0;s<n;s++){const r=i.getTransformFeedbackVarying(e,s);if(!r)throw new Error("activeInfo");const{name:o,type:a,size:c}=r,l=Yl(a),{type:u,components:f}=hl(l);t.push({location:s,name:o,type:u,size:c*f})}return t.sort((s,r)=>s.location-r.location),t}function l1(i,e){const t=[],n=i.getProgramParameter(e,35718);for(let s=0;s<n;s++){const r=i.getActiveUniform(e,s);if(!r)throw new Error("activeInfo");const{name:o,size:a,type:c}=r,{name:l,isArray:u}=y1(o);let f=i.getUniformLocation(e,l);const d={location:f,name:l,size:a,type:c,isArray:u};if(t.push(d),d.size>1)for(let h=0;h<d.size;h++){const g=`${l}[${h}]`;f=i.getUniformLocation(e,g);const p={...d,name:g,location:f};t.push(p)}}return t}function u1(i,e,t){const n=[],s=d1(i,e,t);for(const[o,a]of s){n.push(a);try{const c=Rd(i,e,o,a.name);f1(c,a)}catch(c){const l=c instanceof Error?c.message:String(c);A.once(0,`WebGL uniform block reflection failed for "${a.name}"; using supplied std140 metadata. ${l}`)()}}const r=i.getProgramParameter(e,35382);if(!Number.isInteger(r)||r<0)throw new Error(`Failed to reflect WebGL uniform blocks: ACTIVE_UNIFORM_BLOCKS returned ${String(r)}`);for(let o=0;o<r;o++)s.has(o)||n.push(Rd(i,e,o));return n.sort((o,a)=>o.location-a.location),n}function f1(i,e){for(const t of i.uniforms){const n=e.uniforms.find(s=>t.name===s.name||t.name.endsWith(`.${s.name}`));if(!n)throw new Error(`Failed to validate WebGL uniform block "${e.name}": reflected unexpected member "${t.name}"`);if(t.format!==n.format||t.arrayLength!==n.arrayLength||t.byteOffset!==n.byteOffset||t.byteStride!==n.byteStride)throw new Error(`Failed to validate WebGL uniform block "${e.name}": reflected layout for "${t.name}" does not match supplied std140 metadata`)}}function d1(i,e,t){const n=new Map;for(const r of t.uniformBlockLayouts||[])n.set(r.name,g1(r));for(const r of t.shaderLayout?.bindings||[])m1(r)&&n.set(r.name,r);const s=new Map;for(const r of n.values()){const o=h1(i,e,r.name);if(!o)continue;const{blockIndex:a,blockName:c}=o;if(s.has(a))throw new Error(`Multiple supplied uniform block layouts resolve to active WebGL block "${c}"`);s.set(a,{name:c,location:a,byteLength:r.minBindingSize,vertex:!!(r.visibility&&r.visibility&1),fragment:!!(r.visibility&&r.visibility&2),uniformCount:r.uniforms.length,uniforms:r.uniforms.map(l=>({...l}))})}return s}function h1(i,e,t){const n=t.endsWith("Uniforms")?[t,t.slice(0,-8)]:[t,`${t}Uniforms`];for(const s of n){const r=i.getUniformBlockIndex(e,s);if(r!==4294967295){if(!Number.isInteger(r)||r<0)throw new Error(`Failed to resolve WebGL uniform block "${s}": getUniformBlockIndex returned ${String(r)}`);return{blockIndex:r,blockName:s}}}return null}function Rd(i,e,t,n){const s=n||i.getActiveUniformBlockName(e,t);if(!s)throw new Error(`Failed to reflect WebGL uniform block at index ${t}: missing block name`);const r=(b,x)=>{const w=i.getActiveUniformBlockParameter(e,t,b);if(w==null)throw new Error(`Failed to reflect WebGL uniform block "${s}": ${x} returned null`);return w},o=Zt(r(35391,"UNIFORM_BLOCK_BINDING"),s,"UNIFORM_BLOCK_BINDING",0),a=Zt(r(35392,"UNIFORM_BLOCK_DATA_SIZE"),s,"UNIFORM_BLOCK_DATA_SIZE",0),c=Zt(r(35394,"UNIFORM_BLOCK_ACTIVE_UNIFORMS"),s,"UNIFORM_BLOCK_ACTIVE_UNIFORMS",0),l=bm(r(35395,"UNIFORM_BLOCK_ACTIVE_UNIFORM_INDICES"),s,"UNIFORM_BLOCK_ACTIVE_UNIFORM_INDICES",c),u=mn(i,e,l,35383,"UNIFORM_TYPE",s,c),f=mn(i,e,l,35384,"UNIFORM_SIZE",s,c),d=mn(i,e,l,35386,"UNIFORM_BLOCK_INDEX",s,c),h=mn(i,e,l,35387,"UNIFORM_OFFSET",s,c),g=mn(i,e,l,35388,"UNIFORM_ARRAY_STRIDE",s,c),p=[];for(let b=0;b<c;b++){if(d[b]!==t)throw new Error(`Failed to reflect WebGL uniform block "${s}": active uniform index ${l[b]} belongs to block ${d[b]}, expected ${t}`);const x=l[b],w=i.getActiveUniform(e,x);if(!w)throw new Error(`Failed to reflect WebGL uniform block "${s}": getActiveUniform(${x}) returned null`);const C=Zt(u[b],s,`UNIFORM_TYPE[${b}]`,1),B=Zt(f[b],s,`UNIFORM_SIZE[${b}]`,1),F=Zt(h[b],s,`UNIFORM_OFFSET[${b}]`,0),D=Zt(g[b],s,`UNIFORM_ARRAY_STRIDE[${b}]`,0);if(w.type!==C||w.size!==B)throw new Error(`Failed to reflect WebGL uniform block "${s}": getActiveUniform(${x}) disagrees with getActiveUniforms`);p.push({name:w.name,format:Yl(C),arrayLength:B,byteOffset:F,byteStride:D})}const m={name:s,location:o,byteLength:a,vertex:!!r(35396,"UNIFORM_BLOCK_REFERENCED_BY_VERTEX_SHADER"),fragment:!!r(35398,"UNIFORM_BLOCK_REFERENCED_BY_FRAGMENT_SHADER"),uniformCount:c,uniforms:p},_=new Set(m.uniforms.map(b=>b.name.split(".")[0]).filter(b=>!!b)),v=m.name.replace(/Uniforms$/,"");if(_.size===1&&!_.has(m.name)&&!_.has(v)){const[b]=_;A.warn(`Uniform block "${m.name}" uses GLSL instance "${b}". luma.gl binds uniform buffers by block name ("${m.name}") and alias ("${v}"). Prefer matching the instance name to one of those to avoid confusing silent mismatches.`)()}return m}function mn(i,e,t,n,s,r,o){const a=i.getActiveUniforms(e,t,n);if(a===null)throw new Error(`Failed to reflect WebGL uniform block "${r}": ${s} returned null`);return bm(a,r,s,o)}function bm(i,e,t,n){if(!Array.isArray(i)&&!ArrayBuffer.isView(i))throw new Error(`Failed to reflect WebGL uniform block "${e}": ${t} returned a non-array value`);const s=Array.from(i);if(s.length!==n||s.some(r=>!Number.isInteger(r)))throw new Error(`Failed to reflect WebGL uniform block "${e}": ${t} returned ${s.length} invalid values, expected ${n}`);return s}function Zt(i,e,t,n){if(!Number.isInteger(i)||i<n)throw new Error(`Failed to reflect WebGL uniform block "${e}": ${t} returned ${String(i)}`);return i}function g1(i){const e=pl(i.uniformTypes,{layout:"std140"}),t=p1(i.uniformTypes,e.fields);return{type:"uniform",name:i.name,group:0,location:0,minBindingSize:e.byteLength,uniforms:t}}function p1(i,e){const t=[],n=(r,o)=>{if(typeof o=="string"){const a=e[r];if(!a)throw new Error(`Missing std140 layout field ${r}`);t.push({name:r,format:a.shaderType,arrayLength:1,byteOffset:a.offset*4,byteStride:0});return}if(Array.isArray(o)){s(r,o[0],o[1]);return}for(const[a,c]of Object.entries(o))n(`${r}.${a}`,c)},s=(r,o,a)=>{if(typeof o=="string"){const c=e[`${r}[0]`],l=a>1?e[`${r}[1]`]:void 0;if(!c)throw new Error(`Missing std140 array layout field ${r}[0]`);t.push({name:`${r}[0]`,format:c.shaderType,arrayLength:a,byteOffset:c.offset*4,byteStride:l?(l.offset-c.offset)*4:0});return}if(Array.isArray(o))throw new Error(`Nested uniform arrays are not supported for ${r}`);for(const[c,l]of Object.entries(o)){if(typeof l!="string")throw new Error(`Composite uniform array members are not supported for ${r}`);const u=`${r}[0].${c}`,f=`${r}[1].${c}`,d=e[u],h=a>1?e[f]:void 0;if(!d)throw new Error(`Missing std140 array layout field ${u}`);t.push({name:u,format:d.shaderType,arrayLength:a,byteOffset:d.offset*4,byteStride:h?(h.offset-d.offset)*4:0})}};for(const[r,o]of Object.entries(i))n(r,o);return t}function m1(i){return i.type==="uniform"&&Number.isInteger(i.minBindingSize)&&i.minBindingSize>=0&&Array.isArray(i.uniforms)&&i.uniforms.every(e=>typeof e.name=="string"&&typeof e.format=="string"&&Number.isInteger(e.arrayLength)&&e.arrayLength>0&&Number.isInteger(e.byteOffset)&&e.byteOffset>=0&&Number.isInteger(e.byteStride)&&e.byteStride>=0)}function y1(i){if(i[i.length-1]!=="]")return{name:i,length:1,isArray:!1};const t=/([^[]*)(\[[0-9]+\])?/.exec(i);return{name:vr(t?.[1],`Failed to parse GLSL uniform name ${i}`),length:t?.[2]?1:0,isArray:!!t?.[2]}}class _1 extends Bt{device;handle;vs;fs;introspectedLayout;bindings={};uniforms={};varyings=null;_uniformCount=0;_uniformSetters={};get[Symbol.toStringTag](){return"WEBGLRenderPipeline"}constructor(e,t){super(e,t),this.device=e;const n=this.sharedRenderPipeline||this.device._createSharedRenderPipelineWebGL(t);this.sharedRenderPipeline=n,this.handle=n.handle,this.vs=n.vs,this.fs=n.fs,this.linkStatus=n.linkStatus,this.introspectedLayout=o1(this.device.gl,this.handle,{uniformBlockLayouts:t._uniformBlockLayouts,shaderLayout:t.shaderLayout}),this.device._setWebGLDebugMetadata(this.handle,this,{spector:{id:this.props.id}}),this.shaderLayout=t.shaderLayout?b1(this.introspectedLayout,t.shaderLayout):this.introspectedLayout}destroy(){this.destroyed||(this.sharedRenderPipeline&&!this.props._sharedRenderPipeline&&this.sharedRenderPipeline.destroy(),this.destroyResource())}setBindings(e,t){const n=tc(ol(this.shaderLayout,e));for(const[s,r]of Object.entries(n)){const o=vm(this.shaderLayout,s);if(o){switch(r||A.warn(`Unsetting binding "${s}" in render pipeline "${this.id}"`)(),o.type){case"uniform":if(!(r instanceof Bn)&&!(r.buffer instanceof Bn))throw new Error("buffer value");break;case"texture":if(!(r instanceof Fi||r instanceof Dn||r instanceof kn))throw new Error(`${this} Bad texture binding for ${s}`);break;case"sampler":A.warn(`Ignoring sampler ${s}`)();break;default:throw new Error(o.type)}this.bindings[s]=r}else{const a=this.shaderLayout.bindings.map(c=>`"${c.name}"`).join(", ");t?.disableWarnings||A.warn(`No binding "${s}" in render pipeline "${this.id}", expected one of ${a}`,r)()}}}draw(e){const t=e.renderPass,n=e.bindGroups?tc(e.bindGroups):e.bindings||this.bindings;return t.setPipeline(this),t.setBindings(n),t.setVertexArray(e.vertexArray),t.draw({parameters:e.parameters,topology:e.topology,isInstanced:e.isInstanced,vertexCount:e.vertexCount,indexCount:e.indexCount,instanceCount:e.instanceCount,firstVertex:e.firstVertex,firstIndex:e.firstIndex,firstInstance:e.firstInstance,baseVertex:e.baseVertex,transformFeedback:e.transformFeedback,uniforms:e.uniforms})}_areTexturesRenderable(e){let t=!0;for(const n of this.shaderLayout.bindings)Od(e,n.name)||(A.warn(`Binding ${n.name} not found in ${this.id}`)(),t=!1);return t}_applyBindings(e,t){if(this._syncLinkStatus(),this.linkStatus!=="success")return;const{gl:n}=this.device;n.useProgram(this.handle);let s=0,r=0;for(const o of this.shaderLayout.bindings){const a=Od(e,o.name);if(!a)throw new Error(`No value for binding ${o.name} in ${this.id}`);switch(o.type){case"uniform":const{name:c}=o,l=n.getUniformBlockIndex(this.handle,c);if(l===4294967295)throw new Error(`Invalid uniform block name ${c}`);if(n.uniformBlockBinding(this.handle,l,r),a instanceof Bn)n.bindBufferBase(35345,r,a.handle);else{const f=a;n.bindBufferRange(35345,r,f.buffer.handle,f.offset||0,f.size||f.buffer.byteLength-(f.offset||0))}r+=1;break;case"texture":if(!(a instanceof Fi||a instanceof Dn||a instanceof kn))throw new Error("texture");let u;if(a instanceof Fi)u=a.texture;else if(a instanceof Dn)u=a;else if(a instanceof kn&&a.colorAttachments[0]instanceof Fi)A.warn("Passing framebuffer in texture binding may be deprecated. Use fbo.colorAttachments[0] instead")(),u=a.colorAttachments[0].texture;else throw new Error("No texture");n.activeTexture(33984+s),n.bindTexture(u.glTarget,u.handle),s+=1;break;case"sampler":break;case"storage":case"read-only-storage":throw new Error(`binding type '${o.type}' not supported in WebGL`)}}}_applyUniforms(e){for(const t of this.shaderLayout.uniforms||[]){const{name:n,location:s,type:r,textureUnit:o}=t,a=e[n]??o;a!==void 0&&t1(this.device.gl,s,r,a)}}_syncLinkStatus(){this.linkStatus=this.sharedRenderPipeline.linkStatus}}function b1(i,e){const t={...i,attributes:i.attributes.map(n=>({...n})),bindings:i.bindings.map(n=>({...n}))};for(const n of e?.attributes||[]){const s=t.attributes.find(r=>r.name===n.name);s?(s.type=n.type||s.type,s.stepMode=n.stepMode||s.stepMode):A.warn(`shader layout attribute ${n.name} not present in shader`)}for(const n of e?.bindings||[]){const s=vm(t,n.name);if(!s){A.warn(`shader layout binding ${n.name} not present in shader`);continue}Object.assign(s,n)}return t}function vm(i,e){return i.bindings.find(t=>t.name===e||t.name===`${e}Uniforms`||`${t.name}Uniforms`===e)}function Od(i,e){return i[e]||i[`${e}Uniforms`]||i[e.replace(/Uniforms$/,"")]}const kd=4;class v1 extends hx{device;handle;vs;fs;linkStatus="pending";constructor(e,t){super(e,t),this.device=e,this.handle=t.handle||this.device.gl.createProgram(),this.vs=t.vs,this.fs=t.fs,t.varyings&&t.varyings.length>0&&this.device.gl.transformFeedbackVaryings(this.handle,t.varyings,t.bufferMode||35981),this._linkShaders()}destroy(){this.destroyed||(this.device.gl.useProgram(null),this.device.gl.deleteProgram(this.handle),this.handle.destroyed=!0,this.destroyResource())}async _linkShaders(){const{gl:e}=this.device;if(e.attachShader(this.handle,this.vs.handle),e.attachShader(this.handle,this.fs.handle),A.time(kd,`linkProgram for ${this.id}`)(),e.linkProgram(this.handle),A.timeEnd(kd,`linkProgram for ${this.id}`)(),!this.device.features.has("compilation-status-async-webgl")){const n=this._getLinkStatus();this._reportLinkStatus(n);return}A.once(1,"RenderPipeline linking is asynchronous")(),await this._waitForLinkComplete(),A.info(2,`RenderPipeline ${this.id} - async linking complete: ${this.linkStatus}`)();const t=this._getLinkStatus();this._reportLinkStatus(t)}async _reportLinkStatus(e){switch(e){case"success":return;default:const t=e==="link-error"?"Link error":"Validation error";switch(this.vs.compilationStatus){case"error":throw this.vs.debugShader(),new Error(`${this} ${t} during compilation of ${this.vs}`);case"pending":await this.vs.asyncCompilationStatus,this.vs.debugShader();break}switch(this.fs?.compilationStatus){case"error":throw this.fs.debugShader(),new Error(`${this} ${t} during compilation of ${this.fs}`);case"pending":await this.fs.asyncCompilationStatus,this.fs.debugShader();break}const n=this.device.gl.getProgramInfoLog(this.handle);this.device.reportError(new Error(`${t} during ${e}: ${n}`),this)(),this.device.debug()}}_getLinkStatus(){const{gl:e}=this.device;return e.getProgramParameter(this.handle,35714)?(this._initializeSamplerUniforms(),e.validateProgram(this.handle),e.getProgramParameter(this.handle,35715)?(this.linkStatus="success","success"):(this.linkStatus="error","validation-error")):(this.linkStatus="error","link-error")}_initializeSamplerUniforms(){const{gl:e}=this.device;e.useProgram(this.handle);let t=0;const n=e.getProgramParameter(this.handle,35718);for(let s=0;s<n;s++){const r=e.getActiveUniform(this.handle,s);if(r&&ym(r.type)){const o=r.name.endsWith("[0]"),a=o?r.name.slice(0,-3):r.name,c=e.getUniformLocation(this.handle,a);c!==null&&(t=this._assignSamplerUniform(c,r,o,t))}}}_assignSamplerUniform(e,t,n,s){const{gl:r}=this.device;if(n&&t.size>1){const o=Int32Array.from({length:t.size},(a,c)=>s+c);return r.uniform1iv(e,o),s+t.size}return r.uniform1i(e,s),s+1}async _waitForLinkComplete(){const e=async s=>await new Promise(r=>setTimeout(r,s));if(!this.device.features.has("compilation-status-async-webgl")){await e(10);return}const{gl:n}=this.device;for(;;){if(n.getProgramParameter(this.handle,37297))return;await e(10)}}}class x1 extends cl{device;handle=null;commands=[];constructor(e,t={}){super(e,t),this.device=e}_executeCommands(e=this.commands){for(const t of e)switch(t.name){case"copy-buffer-to-buffer":w1(this.device,t.options);break;case"copy-buffer-to-texture":P1(this.device,t.options);break;case"copy-texture-to-buffer":S1(this.device,t.options);break;case"copy-texture-to-texture":E1(this.device,t.options);break;default:throw new Error(t.name)}}}function w1(i,e){const t=e.sourceBuffer,n=e.destinationBuffer;i.gl.bindBuffer(36662,t.handle),i.gl.bindBuffer(36663,n.handle),i.gl.copyBufferSubData(36662,36663,e.sourceOffset??0,e.destinationOffset??0,e.size),i.gl.bindBuffer(36662,null),i.gl.bindBuffer(36663,null)}function P1(i,e){const{sourceBuffer:t,byteOffset:n=0,destinationTexture:s,mipLevel:r=0,origin:o=[0,0,0],aspect:a="all",bytesPerRow:c,rowsPerImage:l,size:u}=e;if(a!=="all")throw new Error("copyBufferToTexture aspect is not supported in WebGL");s.writeBuffer(t,{byteOffset:n,bytesPerRow:c,rowsPerImage:l,mipLevel:r,x:o[0]??0,y:o[1]??0,z:o[2]??0,width:u[0],height:u[1],depthOrArrayLayers:u[2]})}function S1(i,e){const{sourceTexture:t,mipLevel:n=0,aspect:s="all",width:r=e.sourceTexture.width,height:o=e.sourceTexture.height,depthOrArrayLayers:a,origin:c=[0,0,0],destinationBuffer:l,byteOffset:u=0,bytesPerRow:f,rowsPerImage:d}=e;if(t instanceof re){t.readBuffer({x:c[0]??0,y:c[1]??0,z:c[2]??0,width:r,height:o,depthOrArrayLayers:a,mipLevel:n,aspect:s,byteOffset:u},l);return}if(s!=="all")throw new Error("aspect not supported in WebGL");if(n!==0||a!==void 0||f||d)throw new Error("not implemented");const{framebuffer:h,destroyFramebuffer:g}=xm(t);let p;try{const m=l,_=r||h.width,v=o||h.height,b=vr(h.colorAttachments[0]),x=gm(b.texture.props.format),w=x.format,C=x.type;i.gl.bindBuffer(35051,m.handle),p=i.gl.bindFramebuffer(36160,h.handle),i.gl.readPixels(c[0],c[1],_,v,w,C,u)}finally{i.gl.bindBuffer(35051,null),p!==void 0&&i.gl.bindFramebuffer(36160,p),g&&h.destroy()}}function E1(i,e){const{sourceTexture:t,destinationMipLevel:n=0,origin:s=[0,0],destinationOrigin:r=[0,0,0],destinationTexture:o}=e;let{width:a=e.destinationTexture.width,height:c=e.destinationTexture.height}=e;const{framebuffer:l,destroyFramebuffer:u}=xm(t),[f=0,d=0]=s,[h,g,p]=r,m=i.gl.bindFramebuffer(36160,l.handle);let _,v;if(o instanceof Dn)_=o,a=Number.isFinite(a)?a:_.width,c=Number.isFinite(c)?c:_.height,_._bind(0),v=_.glTarget;else throw new Error("invalid destination");switch(v){case 3553:case 34067:i.gl.copyTexSubImage2D(v,n,h,g,f,d,a,c);break;case 35866:case 32879:i.gl.copyTexSubImage3D(v,n,h,g,p,f,d,a,c);break}_&&_._unbind(),i.gl.bindFramebuffer(36160,m),u&&l.destroy()}function xm(i){if(i instanceof re){const{width:e,height:t,id:n}=i;return{framebuffer:i.device.createFramebuffer({id:`framebuffer-for-${n}`,width:e,height:t,colorAttachments:[i]}),destroyFramebuffer:!0}}return{framebuffer:i,destroyFramebuffer:!1}}function C1(i){switch(i){case"point-list":return 0;case"line-list":return 1;case"line-strip":return 3;case"triangle-list":return 4;case"triangle-strip":return 5;default:throw new Error(i)}}function L1(i){switch(i){case"point-list":return 0;case"line-list":return 1;case"line-strip":return 1;case"triangle-list":return 4;case"triangle-strip":return 4;default:throw new Error(i)}}const T1=[1,2,4,8];class A1 extends Qt{device;handle=null;glParameters={};pipeline=null;bindings={};bindingsPipeline=null;vertexArray=null;constructor(e,t){super(e,t),this.device=e;const n=this.props.framebuffer,s=!n||n.handle===null;s&&e.getDefaultCanvasContext()._resizeDrawingBufferIfNeeded();let r;if(!t?.parameters?.viewport)if(!s&&n){const{width:o,height:a}=n;r=[0,0,o,a]}else{const[o,a]=e.getDefaultCanvasContext().getDrawingBufferSize();r=[0,0,o,a]}if(this.device.pushState(),this.setParameters({viewport:r,...this.props.parameters}),!s&&n?.colorAttachments.length){const o=n.colorAttachments.map((a,c)=>36064+c);this.device.gl.drawBuffers(o)}else s&&this.device.gl.drawBuffers([1029]);this.clear(),this.props.timestampQuerySet&&this.props.beginTimestampIndex!==void 0&&this.props.timestampQuerySet.writeTimestamp(this.props.beginTimestampIndex)}end(){this.destroyed||(this.props.timestampQuerySet&&this.props.endTimestampIndex!==void 0&&this.props.timestampQuerySet.writeTimestamp(this.props.endTimestampIndex),this.device.popState(),this.destroy())}pushDebugGroup(e){}popDebugGroup(){}insertDebugMarker(e){}executeBundles(e){throw new Error("Render bundles are only supported in WebGPU")}setParameters(e={}){const t={...this.glParameters};t.framebuffer=this.props.framebuffer||null,this.props.depthReadOnly&&(t.depthMask=!this.props.depthReadOnly),t.stencilMask=this.props.stencilReadOnly?0:1,t[35977]=this.props.discard,e.viewport&&(e.viewport.length>=6?(t.viewport=e.viewport.slice(0,4),t.depthRange=[e.viewport[4],e.viewport[5]]):t.viewport=e.viewport),e.scissorRect&&(t.scissorTest=!0,t.scissor=e.scissorRect),e.blendConstant&&(t.blendColor=e.blendConstant),e.stencilReference!==void 0&&(t[2967]=e.stencilReference,t[36003]=e.stencilReference),"colorMask"in e&&(t.colorMask=T1.map(n=>!!(n&e.colorMask))),this.glParameters=t,cn(this.device.gl,t)}setPipeline(e){this.pipeline=e}setBindings(e,t){if(!this.pipeline)throw new Error("RenderPass.setPipeline() must be called before setBindings()");this.bindings=tc(ol(this.pipeline.shaderLayout,e)),this.bindingsPipeline=this.pipeline}setVertexArray(e){this.vertexArray=e}draw(e){const t=this.pipeline,n=this.vertexArray;if(!t)throw new Error("RenderPass.setPipeline() must be called before draw()");if(!n)throw new Error("RenderPass.setVertexArray() must be called before draw()");if(t.shaderLayout.bindings.length>0&&this.bindingsPipeline!==t)throw new Error("RenderPass.setBindings() must be called after setPipeline() before draw()");t._syncLinkStatus();const{parameters:s=t.props.parameters,topology:r=t.props.topology,vertexCount:o,indexCount:a,instanceCount:c,isInstanced:l=!1,firstVertex:u=0,transformFeedback:f,uniforms:d=t.uniforms}=e,h=C1(r),g=!!n.indexBuffer,p=n.indexBuffer?.glIndexType,m=a??o??0;if(t.linkStatus!=="success")return A.info(2,`RenderPipeline:${t.id}.draw() aborted - waiting for shader linking`)(),!1;if(!t._areTexturesRenderable(this.bindings))return A.info(2,`RenderPipeline:${t.id}.draw() aborted - textures not yet loaded`)(),!1;this.device.gl.useProgram(t.handle),n.bindBeforeRender(this);const _=f;return _&&_.begin(t.props.topology),t._applyBindings(this.bindings,{disableWarnings:t.props.disableWarnings}),t._applyUniforms(d),VT(this.device,s,this.glParameters,()=>{g&&l?this.device.gl.drawElementsInstanced(h,m,p,u,c||0):g?this.device.gl.drawElements(h,m,p,u):l?this.device.gl.drawArraysInstanced(h,u,o||0,c||0):this.device.gl.drawArrays(h,u,o||0),_&&_.end()}),n.unbindAfterRender(this),!0}drawIndirect(e,t=0){throw new Error("Indirect drawing is only supported in WebGPU")}drawIndexedIndirect(e,t=0){throw new Error("Indirect drawing is only supported in WebGPU")}beginOcclusionQuery(e){this.props.occlusionQuerySet?.beginOcclusionQuery()}endOcclusionQuery(){this.props.occlusionQuerySet?.endOcclusionQuery()}clear(){const e={...this.glParameters};let t=0;this.props.clearColors&&this.props.clearColors.forEach((n,s)=>{n&&this.clearColorBuffer(s,n)}),this.props.clearColor!==!1&&this.props.clearColors===void 0&&(t|=16384,e.clearColor=this.props.clearColor),this.props.clearDepth!==!1&&(t|=256,e.clearDepth=this.props.clearDepth),this.props.clearStencil!==!1&&(t|=1024,e.clearStencil=this.props.clearStencil),t!==0&&kt(this.device.gl,e,()=>{this.device.gl.clear(t)})}clearColorBuffer(e=0,t=[0,0,0,0]){kt(this.device.gl,{framebuffer:this.props.framebuffer},()=>{switch(t.constructor){case Int8Array:case Int16Array:case Int32Array:this.device.gl.clearBufferiv(6144,e,t);break;case Uint8Array:case Uint8ClampedArray:case Uint16Array:case Uint32Array:this.device.gl.clearBufferuiv(6144,e,t);break;case Float32Array:this.device.gl.clearBufferfv(6144,e,t);break;default:throw new Error("clearColorBuffer: color must be typed array")}})}}class Bd extends al{device;handle=null;commandBuffer;constructor(e,t){super(e,t),this.device=e,this.commandBuffer=new x1(e,{id:this.id,userData:this.userData})}destroy(){this.destroyResource()}finish(){return this.destroy(),this.commandBuffer}beginRenderPass(e={}){return new A1(this.device,this._applyTimeProfilingToPassProps(e))}beginComputePass(e={}){throw new Error("ComputePass not supported in WebGL")}copyBufferToBuffer(e){this.commandBuffer.commands.push({name:"copy-buffer-to-buffer",options:e})}copyBufferToTexture(e){this.commandBuffer.commands.push({name:"copy-buffer-to-texture",options:e})}copyTextureToBuffer(e){this.commandBuffer.commands.push({name:"copy-texture-to-buffer",options:e})}copyTextureToTexture(e){this.commandBuffer.commands.push({name:"copy-texture-to-texture",options:e})}pushDebugGroup(e){}popDebugGroup(){}insertDebugMarker(e){}resolveQuerySet(e,t,n){throw new Error("resolveQuerySet is not supported in WebGL")}writeTimestamp(e,t){e.writeTimestamp(t)}}function M1(i){const{target:e,source:t,start:n=0,count:s=1}=i,r=t.length,o=s*r;let a=0;for(let c=n;a<r;a++)e[c++]=t[a]??0;for(;a<o;)a<o-a?(e.copyWithin(n+a,n,n+a),a*=2):(e.copyWithin(n+a,n,n+o-a),a=o);return i.target}class ql extends ll{get[Symbol.toStringTag](){return"VertexArray"}device;handle;attributeInfosByLocation;buffer=null;bufferValue=null;static isConstantAttributeZeroSupported(e){return qy()==="Chrome"}constructor(e,t){super(e,t),this.device=e,this.handle=this.device.gl.createVertexArray(),this.attributeInfosByLocation=new Array(this.maxVertexAttributes).fill(null);for(const n of Object.values(sp(t.shaderLayout,t.bufferLayout)))this.attributeInfosByLocation[n.location]=n}destroy(){super.destroy(),this.buffer&&this.buffer?.destroy(),this.handle&&(this.device.gl.deleteVertexArray(this.handle),this.handle=void 0)}setIndexBuffer(e){const t=e;if(t&&t.glTarget!==34963)throw new Error("Use .setBuffer()");this.device.gl.bindVertexArray(this.handle),this.device.gl.bindBuffer(34963,t?t.handle:null),this.indexBuffer=t,this.device.gl.bindVertexArray(null)}setBuffer(e,t){const n=t;if(n.glTarget===34963)throw new Error("Use .setIndexBuffer()");const{size:s,type:r,stride:o,offset:a,normalized:c,integer:l,divisor:u}=this._getAccessor(e);this.device.gl.bindVertexArray(this.handle),this.device.gl.bindBuffer(34962,n.handle),l?this.device.gl.vertexAttribIPointer(e,s,r,o,a):this.device.gl.vertexAttribPointer(e,s,r,c,o,a),this.device.gl.bindBuffer(34962,null),this.device.gl.enableVertexAttribArray(e),this.device.gl.vertexAttribDivisor(e,u||0),this.attributes[e]=n,this.device.gl.bindVertexArray(null)}setConstantWebGL(e,t){this._enable(e,!1),this.attributes[e]=t}bindBeforeRender(){this.device.gl.bindVertexArray(this.handle),this._applyConstantAttributes()}unbindAfterRender(){this.device.gl.bindVertexArray(null)}_applyConstantAttributes(){for(let e=0;e<this.maxVertexAttributes;++e){const t=this.attributes[e];ArrayBuffer.isView(t)&&this.device.setConstantAttributeWebGL(e,t)}}_getAccessor(e){const t=this.attributeInfosByLocation[e];if(!t)throw new Error(`Unknown attribute location ${e}`);const n=um(t.bufferDataType);return{size:t.bufferComponents,type:n,stride:t.byteStride,offset:t.byteOffset,normalized:t.normalized,integer:t.integer,divisor:t.stepMode==="instance"?1:0}}_enable(e,t=!0){const s=ql.isConstantAttributeZeroSupported(this.device)||e!==0;(t||s)&&(e=Number(e),this.device.gl.bindVertexArray(this.handle),t?this.device.gl.enableVertexAttribArray(e):this.device.gl.disableVertexAttribArray(e),this.device.gl.bindVertexArray(null))}getConstantBuffer(e,t){const n=I1(t),s=n.byteLength*e,r=n.length*e;if(this.buffer&&s!==this.buffer.byteLength)throw new Error(`Buffer size is immutable, byte length ${s} !== ${this.buffer.byteLength}.`);let o=!this.buffer;if(this.buffer=this.buffer||this.device.createBuffer({byteLength:s}),o||=!R1(n,this.bufferValue),o){const a=Cx(t.constructor,r);M1({target:a,source:n,start:0,count:r}),this.buffer.write(a),this.bufferValue=t}return this.buffer}}function I1(i){return Array.isArray(i)?new Float32Array(i):i}function R1(i,e){if(!i||!e||i.length!==e.length||i.constructor!==e.constructor)return!1;for(let t=0;t<i.length;++t)if(i[t]!==e[t])return!1;return!0}class O1 extends ul{device;gl;handle;layout;buffers={};unusedBuffers={};bindOnUse=!0;_bound=!1;constructor(e,t){super(e,t),this.device=e,this.gl=e.gl,this.handle=this.props.handle||this.gl.createTransformFeedback(),this.layout=this.props.layout,t.buffers&&this.setBuffers(t.buffers),Object.seal(this)}destroy(){this.gl.deleteTransformFeedback(this.handle),super.destroy()}begin(e="point-list"){this.gl.bindTransformFeedback(36386,this.handle),this.bindOnUse&&this._bindBuffers(),this.gl.beginTransformFeedback(L1(e))}end(){this.gl.endTransformFeedback(),this.bindOnUse&&this._unbindBuffers(),this.gl.bindTransformFeedback(36386,null)}setBuffers(e){this.buffers={},this.unusedBuffers={},this.bind(()=>{for(const[t,n]of Object.entries(e))this.setBuffer(t,n)})}setBuffer(e,t){const n=this._getVaryingIndex(e),{buffer:s,byteLength:r,byteOffset:o}=this._getBufferRange(t);if(n<0){this.unusedBuffers[e]=s,A.warn(`${this.id} unusedBuffers varying buffer ${e}`)();return}this.buffers[n]={buffer:s,byteLength:r,byteOffset:o},this.bindOnUse||this._bindBuffer(n,s,o,r)}getBuffer(e){if(Dd(e))return this.buffers[e]||null;const t=this._getVaryingIndex(e);return this.buffers[t]??null}bind(e=this.handle){if(typeof e!="function")return this.gl.bindTransformFeedback(36386,e),this;let t;return this._bound?t=e():(this.gl.bindTransformFeedback(36386,this.handle),this._bound=!0,t=e(),this._bound=!1,this.gl.bindTransformFeedback(36386,null)),t}unbind(){this.bind(null)}_getBufferRange(e){if(e instanceof Bn)return{buffer:e,byteOffset:0,byteLength:e.byteLength};const{buffer:t,byteOffset:n=0,byteLength:s=e.buffer.byteLength}=e;return{buffer:t,byteOffset:n,byteLength:s}}_getVaryingIndex(e){if(Dd(e))return Number(e);for(const t of this.layout.varyings||[])if(e===t.name)return t.location;return-1}_bindBuffers(){for(const[e,t]of Object.entries(this.buffers)){const{buffer:n,byteLength:s,byteOffset:r}=this._getBufferRange(t);this._bindBuffer(Number(e),n,r,s)}}_unbindBuffers(){for(const e in this.buffers)this.gl.bindBufferBase(35982,Number(e),null)}_bindBuffer(e,t,n=0,s){const r=t&&t.handle;!r||s===void 0?this.gl.bindBufferBase(35982,e,r):this.gl.bindBufferRange(35982,e,r,n,s)}}function Dd(i){return typeof i=="number"?Number.isInteger(i):/^\d+$/.test(i)}class k1 extends fl{device;handle;_timestampPairs=[];_pendingReads=new Set;_occlusionQuery=null;_occlusionActive=!1;get[Symbol.toStringTag](){return"QuerySet"}constructor(e,t){if(super(e,t),this.device=e,t.type==="timestamp"){if(t.count<2)throw new Error("Timestamp QuerySet requires at least two query slots");this._timestampPairs=new Array(Math.ceil(t.count/2)).fill(null).map(()=>({activeQuery:null,completedQueries:[]})),this.handle=null}else{if(t.count>1)throw new Error("WebGL occlusion QuerySet can only have one value");const n=this.device.gl.createQuery();if(!n)throw new Error("WebGL query not supported");this.handle=n}Object.seal(this)}destroy(){if(!this.destroyed){this.handle&&this.device.gl.deleteQuery(this.handle);for(const e of this._timestampPairs){e.activeQuery&&(this._cancelPendingQuery(e.activeQuery),this.device.gl.deleteQuery(e.activeQuery.handle));for(const t of e.completedQueries)this._cancelPendingQuery(t),this.device.gl.deleteQuery(t.handle)}this._occlusionQuery&&(this._cancelPendingQuery(this._occlusionQuery),this.device.gl.deleteQuery(this._occlusionQuery.handle));for(const e of Array.from(this._pendingReads))this._cancelPendingQuery(e);this.destroyResource()}}isResultAvailable(e){return this.props.type==="timestamp"?e===void 0?this._timestampPairs.some((t,n)=>this._isTimestampPairAvailable(n)):this._isTimestampPairAvailable(this._getTimestampPairIndex(e)):this._occlusionQuery?this._pollQueryAvailability(this._occlusionQuery):!1}async readResults(e){const t=e?.firstQuery||0,n=e?.queryCount||this.props.count-t;if(this._validateRange(t,n),this.props.type==="timestamp"){const s=new Array(n).fill(0n),r=Math.floor(t/2),o=Math.floor((t+n-1)/2);for(let a=r;a<=o;a++){const c=await this._consumeTimestampPairResult(a),l=a*2,u=l+1;l>=t&&l<t+n&&(s[l-t]=0n),u>=t&&u<t+n&&(s[u-t]=c)}return s}if(!this._occlusionQuery)throw new Error("Occlusion query has not been started");return[await this._consumeQueryResult(this._occlusionQuery)]}async readTimestampDuration(e,t){if(this.props.type!=="timestamp")throw new Error("Timestamp durations require a timestamp QuerySet");if(e<0||t>=this.props.count||t<=e)throw new Error("Timestamp duration range is out of bounds");if(e%2!==0||t!==e+1)throw new Error("WebGL timestamp durations require adjacent even/odd query indices");const n=await this._consumeTimestampPairResult(this._getTimestampPairIndex(e));return Number(n)/1e6}beginOcclusionQuery(){if(this.props.type!=="occlusion")throw new Error("Occlusion queries require an occlusion QuerySet");if(!this.handle)throw new Error("WebGL occlusion query is not available");if(this._occlusionActive)throw new Error("Occlusion query is already active");this.device.gl.beginQuery(35887,this.handle),this._occlusionQuery={handle:this.handle,promise:null,result:null,disjoint:!1,cancelled:!1,pollRequestId:null,resolve:null,reject:null},this._occlusionActive=!0}endOcclusionQuery(){if(!this._occlusionActive)throw new Error("Occlusion query is not active");this.device.gl.endQuery(35887),this._occlusionActive=!1}writeTimestamp(e){if(this.props.type!=="timestamp")throw new Error("Timestamp writes require a timestamp QuerySet");const t=this._getTimestampPairIndex(e),n=this._timestampPairs[t];if(e%2===0){if(n.activeQuery)throw new Error("Timestamp query pair is already active");const s=this.device.gl.createQuery();if(!s)throw new Error("WebGL query not supported");const r={handle:s,promise:null,result:null,disjoint:!1,cancelled:!1,pollRequestId:null,resolve:null,reject:null};this.device.gl.beginQuery(35007,s),n.activeQuery=r;return}if(!n.activeQuery)throw new Error("Timestamp query pair was ended before it was started");this.device.gl.endQuery(35007),n.completedQueries.push(n.activeQuery),n.activeQuery=null}_validateRange(e,t){if(e<0||t<0||e+t>this.props.count)throw new Error("Query read range is out of bounds")}_getTimestampPairIndex(e){if(e<0||e>=this.props.count)throw new Error("Query index is out of bounds");return Math.floor(e/2)}_isTimestampPairAvailable(e){const t=this._timestampPairs[e];return!t||t.completedQueries.length===0?!1:this._pollQueryAvailability(t.completedQueries[0])}_pollQueryAvailability(e){if(e.cancelled||this.destroyed)return e.result=0n,!0;if(e.result!==null||e.disjoint)return!0;if(!this.device.gl.getQueryParameter(e.handle,34919))return!1;const n=!!this.device.gl.getParameter(36795);return e.disjoint=n,e.result=n?0n:BigInt(this.device.gl.getQueryParameter(e.handle,34918)),!0}async _consumeTimestampPairResult(e){const t=this._timestampPairs[e];if(!t||t.completedQueries.length===0)throw new Error("Timestamp query pair has no completed result");const n=t.completedQueries.shift();try{return await this._consumeQueryResult(n)}finally{this.device.gl.deleteQuery(n.handle)}}_consumeQueryResult(e){return e.promise||(this._pendingReads.add(e),e.promise=new Promise((t,n)=>{e.resolve=t,e.reject=n;const s=()=>{if(e.pollRequestId=null,e.cancelled||this.destroyed){this._pendingReads.delete(e),e.promise=null,e.resolve=null,e.reject=null,t(0n);return}if(!this._pollQueryAvailability(e)){e.pollRequestId=this._requestAnimationFrame(s);return}this._pendingReads.delete(e),e.promise=null,e.resolve=null,e.reject=null,e.disjoint?n(new Error("GPU timestamp query was invalidated by a disjoint event")):t(e.result||0n)};s()})),e.promise}_cancelPendingQuery(e){if(this._pendingReads.delete(e),e.cancelled=!0,e.pollRequestId!==null&&(this._cancelAnimationFrame(e.pollRequestId),e.pollRequestId=null),e.resolve){const t=e.resolve;e.promise=null,e.resolve=null,e.reject=null,t(0n)}}_requestAnimationFrame(e){return requestAnimationFrame(e)}_cancelAnimationFrame(e){cancelAnimationFrame(e)}}class B1 extends dl{device;gl;handle;signaled;_signaled=!1;constructor(e,t={}){super(e,{}),this.device=e,this.gl=e.gl;const n=this.props.handle||this.gl.fenceSync(this.gl.SYNC_GPU_COMMANDS_COMPLETE,0);if(!n)throw new Error("Failed to create WebGL fence");this.handle=n,this.signaled=new Promise(s=>{const r=()=>{const o=this.gl.clientWaitSync(this.handle,0,0);o===this.gl.ALREADY_SIGNALED||o===this.gl.CONDITION_SATISFIED?(this._signaled=!0,s()):setTimeout(r,1)};r()})}isSignaled(){if(this._signaled)return!0;const e=this.gl.getSyncParameter(this.handle,this.gl.SYNC_STATUS);return this._signaled=e===this.gl.SIGNALED,this._signaled}destroy(){this.destroyed||this.gl.deleteSync(this.handle)}}function wm(i){switch(i){case 6406:case 33326:case 6403:case 36244:return 1;case 33339:case 33340:case 33328:case 33320:case 33319:return 2;case 6407:case 36248:case 34837:return 3;case 6408:case 36249:case 34836:return 4;default:return 0}}function D1(i){switch(i){case 5121:return 1;case 33635:case 32819:case 32820:return 2;case 5126:return 4;default:return 0}}function F1(i,e){const{sourceX:t=0,sourceY:n=0,sourceAttachment:s=0}=e||{};let{target:r=null,sourceWidth:o,sourceHeight:a,sourceDepth:c,sourceFormat:l,sourceType:u}=e||{};const{framebuffer:f,deleteFramebuffer:d}=Pm(i),{gl:h,handle:g}=f;o||=f.width,a||=f.height;const p=f.colorAttachments[s]?.texture;if(!p)throw new Error(`Invalid framebuffer attachment ${s}`);c=p?.depth||1,l||=p?.glFormat||6408,u||=p?.glType||5121,r=U1(r,u,l,o,a);const m=mt.getDataType(r);u=u||i1(m);const _=h.bindFramebuffer(36160,g);return h.readBuffer(36064+s),h.readPixels(t,n,o,a,l,u,r),h.readBuffer(36064),h.bindFramebuffer(36160,_||null),d&&f.destroy(),r}function z1(i,e){const{target:t,sourceX:n=0,sourceY:s=0,sourceFormat:r=6408,targetByteOffset:o=0}=e||{};let{sourceWidth:a,sourceHeight:c,sourceType:l}=e||{};const{framebuffer:u,deleteFramebuffer:f}=Pm(i);a=a||u.width,c=c||u.height;const d=u;l=l||5121;let h=t;if(!h){const p=wm(r),m=D1(l),_=o+a*c*p*m;h=d.device.createBuffer({byteLength:_})}const g=i.device.createCommandEncoder();return g.copyTextureToBuffer({sourceTexture:i,width:a,height:c,origin:[n,s],destinationBuffer:h,byteOffset:o}),g.destroy(),f&&u.destroy(),h}function Pm(i){return i instanceof Zr?{framebuffer:i,deleteFramebuffer:!1}:{framebuffer:N1(i),deleteFramebuffer:!0}}function N1(i,e){const{device:t,width:n,height:s,id:r}=i;return t.createFramebuffer({...e,id:`framebuffer-for-${r}`,width:n,height:s,colorAttachments:[i]})}function U1(i,e,t,n,s,r){if(i)return i;e||=5121;const o=mm(e),a=mt.getTypedArrayConstructor(o),c=wm(t);return new a(n*s*c)}class ai extends Wi{static getDeviceFromContext(e){return e?e.luma?.device??null:null}type="webgl";handle;features;limits;info;canvasContext;preferredColorFormat="rgba8unorm";preferredDepthFormat="depth24plus";commandEncoder;lost;_resolveContextLost;_isLost=!1;gl;_constants;extensions;_polyfilled=!1;spectorJS;get[Symbol.toStringTag](){return"WebGLDevice"}toString(){return`${this[Symbol.toStringTag]}(${this.id})`}isVertexFormatSupported(e){return e!=="unorm8x4-bgra"}constructor(e){super({...e,id:e.id||FT("webgl-device")});const t=Wi._getCanvasContextProps(e);if(!t)throw new Error("WebGLDevice requires props.createCanvasContext to be set");const n=t.canvas?.gl??null;let s=ai.getDeviceFromContext(n);if(s)throw new Error(`WebGL context already attached to device ${s.id}`);this.canvasContext=new BT(this,t),this.lost=new Promise(u=>{this._resolveContextLost=u});const r={...e.webgl};t.alphaMode==="premultiplied"&&(r.premultipliedAlpha=!0),e.powerPreference!==void 0&&(r.powerPreference=e.powerPreference),e.failIfMajorPerformanceCaveat!==void 0&&(r.failIfMajorPerformanceCaveat=e.failIfMajorPerformanceCaveat);const a=this.props._handle||hT(this.canvasContext.canvas,{onContextLost:u=>this._resolveContextLost?.({reason:"destroyed",message:"Entered sleep mode, or too many apps or browser tabs are using the GPU."}),onContextRestored:u=>{console.log("WebGL context restored")}},r);if(!a)throw new Error("WebGL context creation failed");if(s=ai.getDeviceFromContext(a),s){if(e._reuseDevices)return A.log(1,`Not creating a new Device, instead returning a reference to Device ${s.id} already attached to WebGL context`,s)(),this.canvasContext.destroy(),s._reused=!0,s;throw new Error(`WebGL context already attached to device ${s.id}`)}this.handle=a,this.gl=a,this.spectorJS=iT({...this.props,gl:this.handle});const c=Ec(this.handle);c.device=this,c.extensions||(c.extensions={}),this.extensions=c.extensions,this.info=gT(this.gl,this.extensions),this.limits=new RT(this.gl),this.features=new IT(this.gl,this.extensions,this.props._disabledFeatures),this.props._initializeFeatures&&this.features.initializeFeatures(),new ri(this.gl,{log:(...u)=>A.log(1,...u)()}).trackState(this.gl,{copyState:!1}),(e.debug||e.debugWebGL)&&(this.gl=eT(this.gl,{traceWebGL:e.debugWebGL}),A.warn("WebGL debug mode activated. Performance reduced.")()),e.debugWebGL&&(A.level=Math.max(A.level,1)),this.commandEncoder=new Bd(this,{id:`${this}-command-encoder`}),this.canvasContext._startObservers()}destroy(){if(!this.props._reuseDevices&&!this._reused){this._isLost=!0,this.commandEncoder?.destroy();const e=Ec(this.handle);e.device=null}}get isLost(){return this._isLost||this.gl.isContextLost()}createCanvasContext(e){throw new Error("WebGL only supports a single canvas")}createPresentationContext(e){return new DT(this,e||{})}createBuffer(e){const t=this._normalizeBufferProps(e);return new Bn(this,t)}createTexture(e){return new Dn(this,e)}createExternalTexture(e){throw new Error("ExternalTexture is not available on WebGL")}createSampler(e){return new ZT(this,e)}createShader(e){return new $T(this,e)}createFramebuffer(e){return new kn(this,e)}createVertexArray(e){return new ql(this,e)}createTransformFeedback(e){return new O1(this,e)}createQuerySet(e){return new k1(this,e)}createFence(){return new B1(this)}createRenderPipeline(e){return new _1(this,e)}_createSharedRenderPipelineWebGL(e){return new v1(this,e)}createComputePipeline(e){throw new Error("ComputePipeline not supported in WebGL")}createRenderBundleEncoder(e){throw new Error("Render bundles are only supported in WebGPU")}createCommandEncoder(e={}){return new Bd(this,e)}submit(e){let t=null;e||({submittedCommandEncoder:t,commandBuffer:e}=this._finalizeDefaultCommandEncoderForSubmit());try{e._executeCommands(),t&&t.resolveTimeProfilingQuerySet().then(()=>{this.commandEncoder._gpuTimeMs=t._gpuTimeMs}).catch(()=>{})}finally{e.destroy()}}writeBufferViaCommandEncoder(e,t,n,s=0){t.write(n,s)}_finalizeDefaultCommandEncoderForSubmit(){const e=this.commandEncoder,t=e.finish();return this.commandEncoder.destroy(),this.commandEncoder=this.createCommandEncoder({id:e.props.id,timeProfilingQuerySet:e.getTimeProfilingQuerySet()}),{submittedCommandEncoder:e,commandBuffer:t}}readPixelsToArrayWebGL(e,t){return F1(e,t)}readPixelsToBufferWebGL(e,t){return z1(e,t)}setParametersWebGL(e){cn(this.gl,e)}getParametersWebGL(e){return cm(this.gl,e)}withParametersWebGL(e,t){return kt(this.gl,e,t)}resetWebGL(){A.warn("WebGLDevice.resetWebGL is deprecated, use only for debugging")(),cT(this.gl)}_getDeviceSpecificTextureFormatCapabilities(e){return CT(this.gl,e,this.extensions)}loseDevice(){let e=!1;const n=this.getExtension("WEBGL_lose_context").WEBGL_lose_context;return n&&(e=!0,n.loseContext()),this._resolveContextLost?.({reason:"destroyed",message:"Application triggered context loss"}),e}pushState(){ri.get(this.gl).push()}popState(){ri.get(this.gl).pop()}getGLKey(e,t){const n=Number(e);for(const s in this.gl)if(this.gl[s]===n)return`GL.${s}`;return t?.emptyIfUnknown?"":String(e)}getGLKeys(e){const t={emptyIfUnknown:!0};return Object.entries(e).reduce((n,[s,r])=>(n[`${s}:${this.getGLKey(s,t)}`]=`${r}:${this.getGLKey(r,t)}`,n),{})}setConstantAttributeWebGL(e,t){const n=this.limits.maxVertexAttributes;this._constants=this._constants||new Array(n).fill(null);const s=this._constants[e];switch(s&&j1(s,t)&&A.info(1,`setConstantAttributeWebGL(${e}) could have been skipped, value unchanged`)(),this._constants[e]=t,t.constructor){case Float32Array:$1(this,e,t);break;case Int32Array:G1(this,e,t);break;case Uint32Array:V1(this,e,t);break;default:throw new Error("constant")}}getExtension(e){return hi(this.gl,e,this.extensions),this.extensions}_setWebGLDebugMetadata(e,t,n){e.luma=t;const s={props:n.spector,id:n.spector.id};e.__SPECTOR_Metadata=s}}function $1(i,e,t){switch(t.length){case 1:i.gl.vertexAttrib1fv(e,t);break;case 2:i.gl.vertexAttrib2fv(e,t);break;case 3:i.gl.vertexAttrib3fv(e,t);break;case 4:i.gl.vertexAttrib4fv(e,t);break}}function G1(i,e,t){i.gl.vertexAttribI4iv(e,t)}function V1(i,e,t){i.gl.vertexAttribI4uiv(e,t)}function j1(i,e){if(!i||!e||i.length!==e.length||i.constructor!==e.constructor)return!1;for(let t=0;t<i.length;++t)if(i[t]!==e[t])return!1;return!0}const Fd=Object.freeze(Object.defineProperty({__proto__:null,WebGLDevice:ai},Symbol.toStringTag,{value:"Module"}));function wt(){}const W1=({isDragging:i})=>i?"grabbing":"grab",Sm={id:"",width:"100%",height:"100%",style:null,viewState:null,initialViewState:null,pickingRadius:0,pickAsync:"auto",layerFilter:null,parameters:{},parent:null,device:null,deviceProps:{},gl:null,canvas:null,_canvases:null,layers:[],effects:[],views:null,controller:null,useDevicePixels:!0,touchAction:"none",eventRecognizerOptions:{},_framebuffer:null,_animate:!1,_pickable:!0,_typedArrayManagerProps:{},_customRender:null,widgets:[],onDeviceInitialized:wt,onWebGLInitialized:wt,onResize:wt,onViewStateChange:wt,onInteractionStateChange:wt,onBeforeRender:wt,onAfterRender:wt,onLoad:wt,onError:i=>K.error(i.message,i.cause)(),onHover:null,onClick:null,onDragStart:null,onDrag:null,onDragEnd:null,_onMetrics:null,getCursor:W1,getTooltip:null,debug:!1,drawPickingColors:!1};class Zl{constructor(e){this.width=0,this.height=0,this.userData={},this.device=null,this.canvas=null,this.viewManager=null,this.layerManager=null,this.effectManager=null,this.deckRenderer=null,this.deckPicker=null,this.eventManager=null,this.eventManagers={},this.widgetManager=null,this.tooltip=null,this.animationLoop=null,this._canvasContext=null,this._deviceResizeHandler=null,this.cursorState={isHovering:!1,isDragging:!1},this.stats=new Ur({id:"deck.gl"}),this.metrics={fps:0,setPropsTime:0,layersCount:0,drawLayersCount:0,updateLayersCount:0,updateAttributesCount:0,updateAttributesTime:0,framesRedrawn:0,pickTime:0,pickCount:0,pickLayersCount:0,gpuTime:0,gpuTimePerFrame:0,cpuTime:0,cpuTimePerFrame:0,bufferMemory:0,textureMemory:0,renderbufferMemory:0,gpuMemory:0},this._metricsCounter=0,this._hoverPickSequence=0,this._pointerDownPickSequence=0,this._needsRedraw="Initial render",this._canvasManager=new HL({createEventManager:s=>this._createEventManager(s),getEventRoot:s=>this._getEventRoot(s)}),this._ownedCanvas=null,this._pickRequest={mode:"hover",x:-1,y:-1,radius:0,canvasId:void 0,event:null,unproject3D:!1},this._lastPointerDownInfo=null,this._lastPointerDownInfoPromise=null,this._onPointerMove=s=>{const{_pickRequest:r}=this,o=this._getCanvasIdFromEvent(s);if(s.type==="pointerleave")r.x=-1,r.y=-1,r.radius=0,r.canvasId=o;else{if(s.leftButton||s.rightButton)return;{const a=s.offsetCenter;if(!a)return;r.x=a.x,r.y=a.y,r.radius=this.props.pickingRadius,r.canvasId=o}}this.layerManager&&(this.layerManager.context.mousePosition={x:r.x,y:r.y}),r.event=s},this._onEvent=s=>{const r=Ws[s.type],o=s.offsetCenter,a=this._getCanvasIdFromEvent(s);if(!r||!o||!this.layerManager)return;const c=this.layerManager.getLayers(),l=this._getInternalPickingMode();if(!l)return;if(l==="sync"){const f=s.type==="click"&&this._shouldUnproject3D(c)?this._getFirstPickedInfo(this._pickPointSync(this._getPointPickOptions(o.x,o.y,{unproject3D:!0,canvasId:a},c))):this._getLastPointerDownPickingInfo(o.x,o.y,a,c);this._dispatchPickingEvent(f,s);return}(this._lastPointerDownInfoPromise||Promise.resolve(this._getLastPointerDownPickingInfo(o.x,o.y,a,c))).then(f=>{this._dispatchPickingEvent(f,s)}).catch(f=>this.props.onError?.(f))},this._onPointerDown=s=>{const r=s.offsetCenter,o=this._getCanvasIdFromEvent(s);if(!r)return;const a=this._getInternalPickingMode();if(!a)return;const c=this.layerManager?.getLayers()||[],l=++this._pointerDownPickSequence;if(a==="sync"){const f=this._pickPointSync({x:r.x,y:r.y,canvasId:o,radius:this.props.pickingRadius}),d=this._getFirstPickedInfo(f);this._lastPointerDownInfo=d,this._lastPointerDownInfoPromise=Promise.resolve(d);return}const u=this._pickPointAsync(this._getPointPickOptions(r.x,r.y,{canvasId:o},c)).then(f=>this._getFirstPickedInfo(f)).then(f=>(l===this._pointerDownPickSequence&&(this._lastPointerDownInfo=f),f)).catch(f=>{this.props.onError?.(f);const d=this.deckPicker&&this.viewManager?this._getLastPointerDownPickingInfo(r.x,r.y,o,c):{};return l===this._pointerDownPickSequence&&(this._lastPointerDownInfo=d),d});this._lastPointerDownInfo=null,this._lastPointerDownInfoPromise=u};const t=e;this.props={...Sm,...e},e=this.props,this._validateCanvasConfiguration(e),e.viewState&&e.initialViewState&&K.warn("View state tracking is disabled. Use either `initialViewState` for auto update or `viewState` for manual update.")(),this.viewState=this.props.initialViewState,e.device&&(this.device=e.device,this._setDeviceCanvasContext(e.device));let n=this.device;!n&&e.gl&&(e.gl instanceof WebGLRenderingContext&&K.error("WebGL1 context not supported.")(),n=ca.attach(e.gl,{_cacheShaders:!0,_cachePipelines:!0,...this.props.deviceProps})),n||(n=this._createDevice(e)),this.animationLoop=this._createAnimationLoop(n,e),this.setProps(t),e._typedArrayManagerProps&&Zi.setOptions(e._typedArrayManagerProps),this.animationLoop.start()}finalize(){this._restoreDeviceResizeHandler(),this.animationLoop?.stop(),this.animationLoop?.destroy(),this.animationLoop=null,this._hoverPickSequence++,this._pointerDownPickSequence++,this._lastPointerDownInfo=null,this._lastPointerDownInfoPromise=null,this.layerManager?.finalize(),this.layerManager=null,this.viewManager?.finalize(),this.viewManager=null,this.effectManager?.finalize(),this.effectManager=null,this.deckRenderer?.finalize(),this.deckRenderer=null,this.deckPicker?.finalize(),this.deckPicker=null,Object.keys(this._canvasManager.targets).length||this.eventManager?.destroy(),this.eventManager=null,this.eventManagers={},this.widgetManager?.finalize(),this.widgetManager=null,this._canvasManager.finalize(),this._isMultiCanvasMode()?this.canvas=null:this.canvas&&this.canvas===this._ownedCanvas&&(this.canvas.parentElement?.removeChild(this.canvas),this.canvas=null,this._ownedCanvas=null),this._canvasContext=null}setProps(e){this.stats.get("setProps Time").timeStart(),"onLayerHover"in e&&K.removed("onLayerHover","onHover")(),"onLayerClick"in e&&K.removed("onLayerClick","onClick")(),e.initialViewState&&!Me(this.props.initialViewState,e.initialViewState,3)&&(this.viewState=e.initialViewState),he(!("_canvases"in e)||Array.isArray(e._canvases)===this._isMultiCanvasMode()),Object.assign(this.props,e),this._validateCanvasConfiguration(this.props),this._validateInternalPickingMode(),this.device&&this._isMultiCanvasMode()&&this._syncCanvasTargets(),this._setCanvasSize(this.props);const t=Object.create(this.props);if(Object.assign(t,{views:this._getViews(),width:this.width,height:this.height,viewState:this._getViewState(),eventManagers:this.eventManagers}),e.device&&e.device.id!==this.device?.id){const n=e.device.getDefaultCanvasContext();this.animationLoop?.stop(),!this._isMultiCanvasMode()&&this.canvas!==n.canvas&&(this.canvas?.remove(),this.eventManager?.destroy(),this.canvas=null),this._setDeviceCanvasContext(e.device),K.log(`recreating animation loop for new device! id=${e.device.id}`)(),this.animationLoop=this._createAnimationLoop(e.device,e),this.animationLoop.start()}if(this.animationLoop?.setProps(t),e.useDevicePixels!==void 0&&this._canvasContext?.setProps){this._canvasContext.setProps({useDevicePixels:e.useDevicePixels});for(const n of Object.values(this._canvasManager.targets))n.presentationContext.setProps({useDevicePixels:e.useDevicePixels})}this.layerManager&&(this.viewManager.setProps(t),this.layerManager.activateViewport(this.getViewports()[0]),this.layerManager.setProps(t),this.effectManager.setProps(t),this.deckRenderer.setProps(t),this.deckPicker.setProps(t),this.widgetManager.setProps(t)),this.stats.get("setProps Time").timeEnd()}needsRedraw(e={clearRedrawFlags:!1}){if(!this.layerManager)return!1;if(this.props._animate)return"Deck._animate";let t=this._needsRedraw;e.clearRedrawFlags&&(this._needsRedraw=!1);const n=this.viewManager.needsRedraw(e),s=this.layerManager.needsRedraw(e),r=this.effectManager.needsRedraw(e),o=this.deckRenderer.needsRedraw(e);return t=t||n||s||r||o,t}redraw(e){if(!this.layerManager)return;let t=this.needsRedraw({clearRedrawFlags:!0});t=e||t,t&&(this.stats.get("Redraw Count").incrementCount(),this.props._customRender?this.props._customRender(t):this._drawLayers(t))}get isInitialized(){return this.viewManager!==null}getViews(){return he(this.viewManager),this.viewManager.views}getView(e){return he(this.viewManager),this.viewManager.getView(e)}getViewports(e){return he(this.viewManager),this.viewManager.getViewports(e)}getCanvas(){return this.canvas}getCanvasContext(e){const t=e?this.viewManager?.getView(e)?.props.canvasId:void 0;return this._getCanvasContext(t)}getEventManager(e){if(!e||!this.viewManager)return this.eventManager;const t=this.viewManager.getCanvasId(e)||Gi;return this.eventManagers[t]||this.eventManager}async pickObjectAsync(e){const t=(await this._pickAsync("pickObjectAsync","pickObject Time",e)).result;return t.length?t[0]:null}async pickObjectsAsync(e){return await this._pickAsync("pickObjectsAsync","pickObjects Time",e)}pickObject(e){const t=this._pick("pickObject","pickObject Time",e).result;return t.length?t[0]:null}pickMultipleObjects(e){return e.depth=e.depth||10,this._pick("pickObject","pickMultipleObjects Time",e).result}pickObjects(e){return this._pick("pickObjects","pickObjects Time",e)}_pickPositionForController(e,t,n){return this._getInternalPickingMode()!=="sync"?null:this.pickObject({x:e,y:t,radius:0,unproject3D:!0,canvasId:n?this.viewManager?.getCanvasId(n):void 0})}_addResources(e,t=!1){for(const n in e)this.layerManager.resourceManager.add({resourceId:n,data:e[n],forceUpdate:t})}_removeResources(e){for(const t of e)this.layerManager.resourceManager.remove(t)}_addDefaultEffect(e){this.effectManager.addDefaultEffect(e)}_addDefaultShaderModule(e){this.layerManager.addDefaultShaderModule(e)}_removeDefaultShaderModule(e){this.layerManager?.removeDefaultShaderModule(e)}_resolveInternalPickingMode(){const{pickAsync:e}=this.props,t=this.device?.type||this.props.deviceProps?.type;if(e==="auto")return t==="webgpu"?"async":"sync";if(e==="sync"&&t==="webgpu")throw new Error('`pickAsync: "sync"` is not supported when Deck is using a WebGPU device.');return e}_getInternalPickingMode(){try{return this._resolveInternalPickingMode()}catch(e){return this.props.onError?.(e),null}}_validateInternalPickingMode(){this._getInternalPickingMode()}_getFirstPickedInfo({result:e,emptyInfo:t}){return e[0]||t}_shouldUnproject3D(e=this.layerManager?.getLayers()||[]){return e.some(t=>t.props.pickable==="3d")}_getPointPickOptions(e,t,n={},s=this.layerManager?.getLayers()||[]){return{x:e,y:t,canvasId:n.canvasId,radius:this.props.pickingRadius,unproject3D:this._shouldUnproject3D(s),...n}}_pickPointSync(e){return this._pick("pickObject","pickObject Time",e)}_pickPointAsync(e){return this._pickAsync("pickObjectAsync","pickObject Time",e)}_getLastPointerDownPickingInfo(e,t,n,s=this.layerManager?.getLayers()||[]){return this.deckPicker.getLastPickedObject({x:e,y:t,layers:s,viewports:this.getViewports({x:e,y:t,canvasId:n})},this._lastPointerDownInfo)}_applyHoverCallbacks({result:e,emptyInfo:t},n){if(!this.widgetManager)return;this.cursorState.isHovering=e.length>0;let s=t,r=!1;for(const o of e)s=o,r=o.layer?.onHover(o,n)||r;r||(this.props.onHover?.(s,n),this.widgetManager.onHover(s,n))}_dispatchPickingEvent(e,t){if(!this.layerManager||!this.widgetManager)return;const n=Ws[t.type];if(!n)return;const{layer:s}=e,r=s&&(s[n]||s.props[n]),o=this.props[n];let a=!1;r&&(a=r.call(s,e,t)),a||(o?.(e,t),this.widgetManager.onEvent(e,t))}_pickAsync(e,t,n){he(this.deckPicker);const{stats:s}=this,r=this._isMultiCanvasMode()?n.canvasId||this._getDefaultCanvasId():n.canvasId,o=this._getCanvasContext(r)||void 0;s.get("Pick Count").incrementCount(),s.get(t).timeStart(),this._resizeForCanvasTarget(r);const a=this.deckPicker[e]({layers:this.layerManager.getLayers(n),views:this.viewManager.getViews(),viewports:this.getViewports({...n,canvasId:r}),onViewportActive:this.layerManager.activateViewport,effects:this.effectManager.getEffects(),...n,canvasId:r,canvasContext:o});return s.get(t).timeEnd(),a}_pick(e,t,n){he(this.deckPicker);const{stats:s}=this,r=this._isMultiCanvasMode()?n.canvasId||this._getDefaultCanvasId():n.canvasId,o=this._getCanvasContext(r)||void 0;s.get("Pick Count").incrementCount(),s.get(t).timeStart(),this._resizeForCanvasTarget(r);const a=this.deckPicker[e]({layers:this.layerManager.getLayers(n),views:this.viewManager.getViews(),viewports:this.getViewports({...n,canvasId:r}),onViewportActive:this.layerManager.activateViewport,effects:this.effectManager.getEffects(),...n,canvasId:r,canvasContext:o});return s.get(t).timeEnd(),a}_createCanvas(e){let t=e.canvas;return typeof t=="string"&&(t=document.getElementById(t),he(t)),t?this._ownedCanvas=null:(t=document.createElement("canvas"),t.id=e.id||"deckgl-overlay",e.width&&typeof e.width=="number"&&(t.width=e.width),e.height&&typeof e.height=="number"&&(t.height=e.height),(e.parent||document.body).appendChild(t),this._ownedCanvas=t),Object.assign(t.style,e.style),t}_isMultiCanvasMode(){return Array.isArray(this.props._canvases)}_getDefaultCanvasId(){return this._canvasManager.order[0]||Gi}_validateCanvasConfiguration(e){Array.isArray(e._canvases)&&(he(!e.canvas),he(!e.gl),he(!e.device?.canvasContext||e.device.getDefaultCanvasContext().offscreenCanvas))}_createEventManager(e){const t=new F3(e,{touchAction:this.props.touchAction,recognizers:Object.keys(Vf).map(n=>{const[s,r,o,a]=Vf[n],c=this.props.eventRecognizerOptions?.[n],l={...r,...c,event:n};return{recognizer:new s(l),recognizeWith:o,requireFailure:a}}),events:{pointerdown:this._onPointerDown,pointermove:this._onPointerMove,pointerleave:this._onPointerMove}});for(const n in Ws)n==="dblclick"?t.watch(n,this._onEvent):t.on(n,this._onEvent);return t}_getEventRoot(e){return e.closest(".deck-events-root")||this.props.parent?.querySelector(".deck-events-root")||e}_syncCanvasTargets(){if(!this.device||!this._isMultiCanvasMode())return;this._canvasManager.syncCanvasEntries({device:this.device,canvases:this.props._canvases||[],useDevicePixels:this.props.useDevicePixels}),this.eventManagers=this._canvasManager.eventManagers;const e=this._getDefaultCanvasId();this.eventManager=this.eventManagers[e]||null,this.canvas=this._canvasManager.targets[e]?.canvas||null}_setCanvasContext(e){this._canvasContext=e,"style"in e.canvas&&(this.canvas=e.canvas)}_setDeviceCanvasContext(e,t={}){const n=e.getDefaultCanvasContext();this._setCanvasContext(n),this._setDeviceResizeHandler(e,t)}_setDeviceResizeHandler(e,t={}){const n=!!t.syncDrawingBuffer;if(this._deviceResizeHandler?.device===e){this._deviceResizeHandler.syncDrawingBuffer=n;return}this._restoreDeviceResizeHandler();const s=r=>{this._isMultiCanvasMode()?this._updateMultiCanvasDimensions():r===this._canvasContext&&this._canvasContext&&this._onCanvasContextResize(this._canvasContext,{syncDrawingBuffer:this._deviceResizeHandler?.syncDrawingBuffer})};e.props.onResize=s,this._deviceResizeHandler={device:e,onResize:s,syncDrawingBuffer:n}}_restoreDeviceResizeHandler(){const e=this._deviceResizeHandler;e&&e.device.props?.onResize===e.onResize&&(e.device.props.onResize=wt),this._deviceResizeHandler=null}_setCanvasSize(e){if(this._isMultiCanvasMode()||!this.canvas)return;const{width:t,height:n}=e;if(t||t===0){const s=Number.isFinite(t)?`${t}px`:t;this.canvas.style.width=s}if(n||n===0){const s=Number.isFinite(n)?`${n}px`:n;this.canvas.style.position=e.style?.position||"absolute",this.canvas.style.height=s}}_getCanvasIdFromEvent(e){return this._canvasManager.getCanvasIdFromEvent(e?.rootElement)}_getCanvasContext(e){return this._canvasManager.getTarget(e)?.presentationContext||this._canvasContext}_resizeForCanvasTarget(e){const t=this._canvasManager.getTarget(e);if(!t||!this.device?.canvasContext)return;const[n,s]=t.presentationContext.getDrawingBufferSize();this.device.canvasContext.setDrawingBufferSize(n,s)}_createDeviceCanvas(e){if(this._isMultiCanvasMode()){const t=globalThis.OffscreenCanvas;if(!t)throw new Error("`_canvases` requires OffscreenCanvas support.");const n=typeof e.width=="number"&&Number.isFinite(e.width)?e.width:1,s=typeof e.height=="number"&&Number.isFinite(e.height)?e.height:1;return new t(n,s)}return this._createCanvas(e)}_updateCanvasSize(e=this._canvasContext){if(this._isMultiCanvasMode()){this._updateMultiCanvasDimensions();return}const{canvas:t}=this,[n,s]=e?e.getCSSSize():[t?.clientWidth??t?.width??0,t?.clientHeight??t?.height??0];(n!==this.width||s!==this.height)&&(this.width=n,this.height=s,this.viewManager?.setProps({width:n,height:s}),this.layerManager?.activateViewport(this.getViewports()[0]),this.props.onResize({width:n,height:s},e||void 0))}_onCanvasContextResize(e,t={}){if(t.syncDrawingBuffer){const{width:n,height:s}=e.canvas;e.setDrawingBufferSize(n,s)}this._needsRedraw="Canvas resized",this._updateCanvasSize(e)}_updateMultiCanvasDimensions(){const[e,t]=this._getCanvasContext()?.getCSSSize()||[0,0];(e!==this.width||t!==this.height)&&(this.width=e,this.height=t,this.props.onResize({width:e,height:t})),this._needsRedraw="Canvas resized",this.viewManager?.setNeedsUpdate("Canvas resized"),this.viewManager?.setProps({width:this.width,height:this.height})}_createAnimationLoop(e,t){const{gl:n,onError:s}=t;return new Fl({device:e,autoResizeDrawingBuffer:!n&&!Array.isArray(t._canvases),autoResizeViewport:!1,onInitialize:r=>this._setDevice(r.device),onRender:this._onRenderFrame.bind(this),onError:s})}_createDevice(e){const t=this.props.deviceProps?.createCanvasContext,n=typeof t=="object"?t:void 0,s={adapters:[],_cacheShaders:!0,_cachePipelines:!0,...e.deviceProps};s.adapters.includes(ca)||s.adapters.push(ca);const r={alphaMode:this.props.deviceProps?.type==="webgpu"?"premultiplied":void 0};return Ka.createDevice({_reuseDevices:!0,type:"webgl",...s,createCanvasContext:{...r,...n,canvas:this._createDeviceCanvas(e),useDevicePixels:this.props.useDevicePixels,autoResize:!0}})}_getViewState(){return this.props.viewState||this.viewState}_getViews(){const{views:e}=this.props,t=Array.isArray(e)?e:e?[e]:[new om({id:"default-view"})];return t.length&&this.props.controller&&(t[0]=t[0].clone({controller:this.props.controller})),t}_onContextLost(){const{onError:e}=this.props;this.animationLoop&&e&&e(new Error("WebGL context is lost"))}_pickAndCallback(){const{_pickRequest:e}=this;if(e.event){const t=e.event,n=this.layerManager?.getLayers()||[],s=this._getPointPickOptions(e.x,e.y,{canvasId:e.canvasId,radius:e.radius,mode:e.mode},n),r=this._getInternalPickingMode(),o=++this._hoverPickSequence;if(e.event=null,e.canvasId=void 0,!r)return;if(r==="sync"){this._applyHoverCallbacks(this._pickPointSync(s),t);return}this._pickPointAsync(s).then(({result:a,emptyInfo:c})=>{o===this._hoverPickSequence&&this._applyHoverCallbacks({result:a,emptyInfo:c},t)}).catch(a=>this.props.onError?.(a))}}_updateCursor(){const e=this.props.getCursor(this.cursorState);if(this._isMultiCanvasMode()){for(const n of Object.values(this._canvasManager.targets))n.canvas.style.cursor=e;return}const t=this.props.parent||this.canvas;t&&(t.style.cursor=e)}_setDevice(e){if(this.device=e,this._validateInternalPickingMode(),!this.animationLoop)return;this._setDeviceCanvasContext(e,{syncDrawingBuffer:!!(this.props.gl&&this.props.device!==e)}),this._isMultiCanvasMode()?this._syncCanvasTargets():this.canvas&&!this.canvas.isConnected&&this.props.parent&&this.props.parent.insertBefore(this.canvas,this.props.parent.firstChild),this.device.type==="webgl"&&this.device.setParametersWebGL({blend:!0,blendFunc:[770,771,1,771],polygonOffsetFill:!0,depthTest:!0,depthFunc:515}),this.props.onDeviceInitialized(this.device),this.device.type==="webgl"&&this.props.onWebGLInitialized(this.device.gl);const t=new Zp;if(t.play(),this.animationLoop.attachTimeline(t),!this._isMultiCanvasMode()){const r=this.canvas&&this._getEventRoot(this.canvas);he(r),this.eventManager=this._createEventManager(r),this.eventManagers={[Gi]:this.eventManager}}this.viewManager=new dL({timeline:t,eventManager:this.eventManager,eventManagers:this.eventManagers,getCanvasContext:this._isMultiCanvasMode()?this.getCanvasContext.bind(this):void 0,onViewStateChange:this._onViewStateChange.bind(this),onInteractionStateChange:this._onInteractionStateChange.bind(this),pickPosition:this._pickPositionForController.bind(this),views:this._getViews(),viewState:this._getViewState(),width:this.width,height:this.height});const n=this.viewManager.getViewports()[0];this.layerManager=new fL(this.device,{deck:this,stats:this.stats,viewport:n,timeline:t}),this.effectManager=new kL({deck:this,device:this.device}),this.deckRenderer=new FL(this.device,{stats:this.stats}),this.deckPicker=new UL(this.device,{stats:this.stats});const s=this.props.parent?.querySelector(".deck-widgets-root")||(this._isMultiCanvasMode()?this.props.parent||this.canvas?.parentElement:null)||this.canvas?.parentElement;this.widgetManager=new VL({deck:this,parentElement:s}),this.widgetManager.addDefault(new am),this.setProps({}),this._updateCanvasSize(this._canvasContext),this.props.onLoad()}_drawLayers(e,t){const{device:n,gl:s}=this.layerManager.context;this.props.onBeforeRender({device:n,gl:s});const r={target:this.props._framebuffer,layers:this.layerManager.getLayers(),viewports:this.viewManager.getViewports(),onViewportActive:this.layerManager.activateViewport,views:this.viewManager.getViews(),pass:"screen",effects:this.effectManager.getEffects(),...t};if(this._isMultiCanvasMode()&&r.pass==="screen"&&!r.target&&this._canvasManager.order.length)for(const o of this._canvasManager.order){const a=r.viewports.filter(u=>this.viewManager.getCanvasId(u.id)===o);if(!a.length){const u=this._canvasManager.targets[o];this._resizeForCanvasTarget(o),this.deckRenderer?.renderLayers({...r,canvasContext:u.presentationContext,target:u.presentationContext.getCurrentFramebuffer(),viewports:[],clearCanvas:!0}),u.presentationContext.present();continue}const c=this._canvasManager.targets[o];this._resizeForCanvasTarget(o);const l=c.presentationContext.getCurrentFramebuffer();this.deckRenderer?.renderLayers({...r,canvasContext:c.presentationContext,target:l,viewports:a}),c.presentationContext.present()}else this.deckRenderer?.renderLayers(r);r.pass==="screen"&&this.widgetManager.onRedraw({viewports:r.viewports,layers:r.layers}),this.props.onAfterRender({device:n,gl:s})}_onRenderFrame(){this._getFrameStats(),this._metricsCounter++%60===0&&(this._getMetrics(),this.stats.reset(),K.table(4,this.metrics)(),this.props._onMetrics&&this.props._onMetrics(this.metrics)),this._updateCursor(),this.layerManager.updateLayers(),this._pickAndCallback(),this.redraw(),this.viewManager&&this.viewManager.updateViewStates()}_onViewStateChange(e){const t=this.props.onViewStateChange(e)||e.viewState;this.viewState&&(this.viewState={...this.viewState,[e.viewId]:t},this.props.viewState||this.viewManager&&this.viewManager.setProps({viewState:this.viewState}))}_onInteractionStateChange(e){this.cursorState.isDragging=e.isDragging||!1,this.props.onInteractionStateChange(e)}_getFrameStats(){const{stats:e}=this;e.get("frameRate").timeEnd(),e.get("frameRate").timeStart();const t=this.animationLoop.stats;e.get("GPU Time").addTime(t.get("GPU Time").lastTiming),e.get("CPU Time").addTime(t.get("CPU Time").lastTiming)}_getMetrics(){const{metrics:e,stats:t}=this;e.fps=t.get("frameRate").getHz(),e.setPropsTime=t.get("setProps Time").time,e.updateAttributesTime=t.get("Update Attributes").time,e.framesRedrawn=t.get("Redraw Count").count,e.pickTime=t.get("pickObject Time").time+t.get("pickMultipleObjects Time").time+t.get("pickObjects Time").time,e.pickCount=t.get("Pick Count").count,e.layersCount=this.layerManager?.layers.length??0,e.drawLayersCount=t.get("Layers rendered").lastSampleCount,e.pickLayersCount=t.get("Layers picked").lastSampleCount,e.updateLayersCount=t.get("Layer updates").count,e.updateAttributesCount=t.get("Attributes updated").count,e.gpuTime=t.get("GPU Time").time,e.cpuTime=t.get("CPU Time").time,e.gpuTimePerFrame=t.get("GPU Time").getAverageTime(),e.cpuTimePerFrame=t.get("CPU Time").getAverageTime();const n=Ka.stats.get("GPU Time and Memory");e.bufferMemory=n.get("Buffer Memory").count,e.textureMemory=n.get("Texture Memory").count,e.renderbufferMemory=n.get("Renderbuffer Memory").count,e.gpuMemory=n.get("GPU Memory").count}}Zl.defaultProps=Sm;Zl.VERSION=_v;function H1(i){switch(i){case"float64":return Float64Array;case"uint8":case"unorm8":return Uint8ClampedArray;default:return el(i)}}const Y1=mt.getDataType.bind(mt);function Ms(i,e,t){if(e.size>4)return null;const n=t==="webgpu"&&e.type==="uint8"?"unorm8":e.type,s=e.size,r=!!(t!=="webgpu"&&s===3&&n&&["uint8","sint8","unorm8","snorm8","uint16","sint16","unorm16","snorm16"].includes(n));return{attribute:i,format:s>1?`${n}x${s}${r?"-webgl":""}`:e.type,byteOffset:e.offset||0}}function ft(i){return i.stride||i.size*i.bytesPerElement}function q1(i,e){return i.type===e.type&&i.size===e.size&&ft(i)===ft(e)&&(i.offset||0)===(e.offset||0)}function Tc(i,e){e.offset&&K.removed("shaderAttribute.offset","vertexOffset, elementOffset")();const t=ft(i),n=e.vertexOffset!==void 0?e.vertexOffset:i.vertexOffset||0,s=e.elementOffset||0,r=n*t+s*i.bytesPerElement+(i.offset||0);return{...e,offset:r,stride:t}}function Z1(i,e){const t=Tc(i,e);return{high:t,low:{...t,offset:t.offset+i.size*4}}}class X1{constructor(e,t,n){this._buffer=null,this.device=e,this.id=t.id||"",this.size=t.size||1;const s=t.logicalType||t.type,r=s==="float64";let{defaultValue:o}=t;o=Number.isFinite(o)?[o]:o||new Array(this.size).fill(0);let a;r?a="float32":!s&&t.isIndexed?a="uint32":a=s||"float32";let c=H1(s||a);this.doublePrecision=r,r&&t.fp64===!1&&(c=Float32Array),this.value=null,this.settings={...t,defaultType:c,defaultValue:o,logicalType:s,type:a,normalized:a.includes("norm"),size:this.size,bytesPerElement:c.BYTES_PER_ELEMENT},this.state={...n,externalBuffer:null,bufferAccessor:this.settings,allocatedValue:null,numInstances:0,bounds:null,constant:!1}}get isConstant(){return this.state.constant}get buffer(){return this._buffer}get byteOffset(){const e=this.getAccessor();return e.vertexOffset?e.vertexOffset*ft(e):0}get numInstances(){return this.state.numInstances}set numInstances(e){this.state.numInstances=e}get isDoublePrecisionBuffer(){return this._shouldSplitDoublePrecisionValue(this.value)}delete(){this._buffer&&(this._buffer.delete(),this._buffer=null),Zi.release(this.state.allocatedValue),this.state.allocatedValue=null}getBuffer(){return this.state.constant&&this.device.type!=="webgpu"?null:this.state.externalBuffer||this._buffer}getValue(e=this.id,t=null){const n={};if(this.state.constant){const s=this.value;if(this.device.type==="webgpu"&&this._buffer)n[e]=this._buffer;else if(t){const r=Tc(this.getAccessor(),t),o=r.offset/s.BYTES_PER_ELEMENT,a=r.size||this.size;n[e]=s.subarray(o,o+a)}else n[e]=s}else n[e]=this.getBuffer();return this.doublePrecision&&(this.isDoublePrecisionBuffer?n[`${e}64Low`]=n[e]:n[`${e}64Low`]=new Float32Array(this.size)),n}_getBufferLayout(e=this.id,t=null){const n=this.getAccessor(),s=[],r={name:this.id,byteStride:this.device.type==="webgpu"&&this.state.constant?0:ft(n)};if(this.doublePrecision){const o=Z1(n,t||{});s.push(Ms(e,{...n,...o.high},this.device.type),Ms(`${e}64Low`,{...n,...o.low},this.device.type))}else if(t){const o=Tc(n,t);s.push(Ms(e,{...n,...o},this.device.type))}else s.push(Ms(e,n,this.device.type));return r.attributes=s.filter(Boolean),r}setAccessor(e){this.state.bufferAccessor=e}getAccessor(){return this.state.bufferAccessor}getBounds(){if(this.state.bounds)return this.state.bounds;let e=null;if(this.state.constant&&this.value){const t=Array.from(this.value);e=[t,t]}else{const{value:t,numInstances:n,size:s}=this,r=n*s;if(t&&r&&t.length>=r){const o=new Array(s).fill(1/0),a=new Array(s).fill(-1/0);for(let c=0;c<r;)for(let l=0;l<s;l++){const u=t[c++];u<o[l]&&(o[l]=u),u>a[l]&&(a[l]=u)}e=[o,a]}}return this.state.bounds=e,e}setData(e){const{state:t}=this;let n;ArrayBuffer.isView(e)?n={value:e}:e instanceof q?n={buffer:e}:n=e;const s={...this.settings,...n};if(ArrayBuffer.isView(n.value)){if(!n.type)if(this.doublePrecision&&n.value instanceof Float64Array)s.type="float32";else{const o=Y1(n.value);s.type=s.normalized?o.replace("int","norm"):o}s.bytesPerElement=n.value.BYTES_PER_ELEMENT,s.stride=ft(s)}if(t.bounds=null,n.constant){let r=n.value;if(r=this._normalizeValue(r,[],0),this.settings.normalized&&(r=this.normalizeConstant(r)),!(!t.constant||!this._areValuesEqual(r,this.value)))return!1;t.externalBuffer=null,t.constant=!0,this.value=ArrayBuffer.isView(r)?r:new Float32Array(r)}else if(n.buffer){const r=n.buffer;t.externalBuffer=r,t.constant=!1,this.value=n.value||null}else if(n.value){this._checkExternalBuffer(n);const r=n.value;let o=r;t.externalBuffer=null,t.constant=!1,this.value=r,this._shouldSplitDoublePrecisionValue(o)&&(o=Hs(o,s),r instanceof Float32Array&&(s.stride=s.size*2*Float32Array.BYTES_PER_ELEMENT));let{buffer:a}=this;const c=ft(s),l=(s.vertexOffset||0)*c;if(this.settings.isIndexed){const f=this.settings.defaultType;o.constructor!==f&&(o=new f(o))}const u=o.byteLength+l+c*2;(!a||a.byteLength<u)&&(a=this._createBuffer(u)),a.write(o,l)}return this.setAccessor(s),!0}updateSubBuffer(e={}){this.state.bounds=null;const t=this.value,{startOffset:n=0,endOffset:s}=e,r=this._shouldSplitDoublePrecisionValue(t);this.buffer.write(r?Hs(t,{size:this.size,startIndex:n,endIndex:s}):t.subarray(n,s),n*(r?8:t.BYTES_PER_ELEMENT)+this.byteOffset)}allocate(e,t=!1){const{state:n}=this,s=n.allocatedValue,r=Zi.allocate(s,e+1,{size:this.size,type:this.settings.defaultType,copy:t});this.value=r;const o=this._shouldSplitDoublePrecisionValue(r),a=o&&r instanceof Float32Array?{...this.settings,stride:this.size*2*Float32Array.BYTES_PER_ELEMENT}:this.settings;this.setAccessor(a);const{byteOffset:c}=this;let{buffer:l}=this;const u=r.byteLength*(o&&r instanceof Float32Array?2:1);return(!l||l.byteLength<u+c)&&(l=this._createBuffer(u+c),t&&s&&l.write(this._shouldSplitDoublePrecisionValue(s)?Hs(s,this):s,c)),n.allocatedValue=r,n.constant=!1,n.externalBuffer=null,!0}_shouldSplitDoublePrecisionValue(e){return!!(this.doublePrecision&&(e instanceof Float64Array||this.device.type==="webgpu"&&e instanceof Float32Array))}_checkExternalBuffer(e){const{value:t}=e;if(!ArrayBuffer.isView(t))throw new Error(`Attribute ${this.id} value is not TypedArray`);const n=this.settings.defaultType;let s=!1;if(this.doublePrecision&&(s=t.BYTES_PER_ELEMENT<4),s)throw new Error(`Attribute ${this.id} does not support ${t.constructor.name}`);!(t instanceof n)&&this.settings.normalized&&!("normalized"in e)&&K.warn(`Attribute ${this.id} is normalized`)()}normalizeConstant(e){switch(this.settings.type){case"snorm8":return new Float32Array(e).map(t=>(t+128)/255*2-1);case"snorm16":return new Float32Array(e).map(t=>(t+32768)/65535*2-1);case"unorm8":return new Float32Array(e).map(t=>t/255);case"unorm16":return new Float32Array(e).map(t=>t/65535);default:return e}}_normalizeValue(e,t,n){const{defaultValue:s,size:r}=this.settings;if(Number.isFinite(e))return t[n]=e,t;if(!e){let o=r;for(;--o>=0;)t[n+o]=s[o];return t}switch(r){case 4:t[n+3]=Number.isFinite(e[3])?e[3]:s[3];case 3:t[n+2]=Number.isFinite(e[2])?e[2]:s[2];case 2:t[n+1]=Number.isFinite(e[1])?e[1]:s[1];case 1:t[n+0]=Number.isFinite(e[0])?e[0]:s[0];break;default:let o=r;for(;--o>=0;)t[n+o]=Number.isFinite(e[o])?e[o]:s[o]}return t}_areValuesEqual(e,t){if(!e||!t)return!1;const{size:n}=this;for(let s=0;s<n;s++)if(e[s]!==t[s])return!1;return!0}_createBuffer(e){this._buffer&&this._buffer.destroy();const{isIndexed:t,type:n}=this.settings,s=this.device.type==="webgpu"&&!t?q.VERTEX|q.STORAGE|q.COPY_DST|q.COPY_SRC:(t?q.INDEX:q.VERTEX)|q.COPY_DST;return this._buffer=this.device.createBuffer({...this._buffer?.props,id:this.id,usage:s,indexType:t?n:void 0,byteLength:e}),this._buffer}}const zd=[],Nd=[];function os(i,e=0,t=1/0){let n=zd;const s={index:-1,data:i,target:[]};return i?typeof i[Symbol.iterator]=="function"?n=i:i.length>0&&(Nd.length=i.length,n=Nd):n=zd,(e>0||Number.isFinite(t))&&(n=(Array.isArray(n)?n:Array.from(n)).slice(e,t),s.index=e-1),{iterable:n,objectInfo:s}}function Em(i){return i&&i[Symbol.asyncIterator]}function Cm(i,e){const{size:t,stride:n,offset:s,startIndices:r,nested:o}=e,a=i.BYTES_PER_ELEMENT,c=n?n/a:t,l=s?s/a:0,u=Math.floor((i.length-l)/c);return(f,{index:d,target:h})=>{if(!r){const _=d*c+l;for(let v=0;v<t;v++)h[v]=i[_+v];return h}const g=r[d],p=r[d+1]||u;let m;if(o){m=new Array(p-g);for(let _=g;_<p;_++){const v=_*c+l;h=new Array(t);for(let b=0;b<t;b++)h[b]=i[v+b];m[_-g]=h}}else if(c===t)m=i.subarray(g*t+l,p*t+l);else{m=new i.constructor((p-g)*t);let _=0;for(let v=g;v<p;v++){const b=v*c+l;for(let x=0;x<t;x++)m[_++]=i[b+x]}}return m}}const K1=[],qs=[[0,1/0]];function Q1(i,e){if(i===qs||(e[0]<0&&(e[0]=0),e[0]>=e[1]))return i;const t=[],n=i.length;let s=0;for(let r=0;r<n;r++){const o=i[r];o[1]<e[0]?(t.push(o),s=r+1):o[0]>e[1]?t.push(o):e=[Math.min(o[0],e[0]),Math.max(o[1],e[1])]}return t.splice(s,0,e),t}const J1={interpolation:{duration:0,easing:i=>i},spring:{stiffness:.05,damping:.5}};function Lm(i,e){if(!i)return null;Number.isFinite(i)&&(i={type:"interpolation",duration:i});const t=i.type||"interpolation";return{...J1[t],...e,...i,type:t}}class Tm extends X1{constructor(e,t){super(e,t,{startIndices:null,constantValue:null,lastExternalBuffer:null,binaryValue:null,binaryAccessor:null,needsUpdate:!0,needsRedraw:!1,layoutChanged:!1,updateRanges:qs}),this.constant=!1,this.settings.update=t.update||(t.accessor?this._autoUpdater:void 0),Object.seal(this.settings),Object.seal(this.state),this._validateAttributeUpdaters()}get startIndices(){return this.state.startIndices}set startIndices(e){this.state.startIndices=e}needsUpdate(){return this.state.needsUpdate}needsRedraw({clearChangedFlags:e=!1}={}){const t=this.state.needsRedraw;return this.state.needsRedraw=t&&!e,t}layoutChanged(){return this.state.layoutChanged}setAccessor(e){var t;(t=this.state).layoutChanged||(t.layoutChanged=!q1(e,this.getAccessor())),super.setAccessor(e)}getUpdateTriggers(){const{accessor:e}=this.settings;return[this.id].concat(typeof e!="function"&&e||[])}supportsTransition(){return!!this.settings.transition}getTransitionSetting(e){if(!e||!this.supportsTransition())return null;const{accessor:t}=this.settings,n=this.settings.transition,s=Array.isArray(t)?e[t.find(r=>e[r])]:e[t];return Lm(s,n)}setNeedsUpdate(e=this.id,t){if(this.state.needsUpdate=this.state.needsUpdate||e,this.setNeedsRedraw(e),t){const{startRow:n=0,endRow:s=1/0}=t;this.state.updateRanges=Q1(this.state.updateRanges,[n,s])}else this.state.updateRanges=qs}clearNeedsUpdate(){this.state.needsUpdate=!1,this.state.updateRanges=K1}setNeedsRedraw(e=this.id){this.state.needsRedraw=this.state.needsRedraw||e}allocate(e){const{state:t,settings:n}=this;if(n.noAlloc)return!1;if(n.update){const s=this.isConstant;return super.allocate(e,t.updateRanges!==qs),t.layoutChanged||(t.layoutChanged=s&&this.device.type==="webgpu"),!0}return!1}updateBuffer({numInstances:e,data:t,props:n,context:s}){if(!this.needsUpdate())return!1;const{state:{updateRanges:r},settings:{update:o,noAlloc:a}}=this;let c=!0;if(o){for(const[l,u]of r)o.call(s,this,{data:t,startRow:l,endRow:u,props:n,numInstances:e});if(this.value)if(this.constant||!this.buffer||this.buffer.byteLength<this.value.byteLength+this.byteOffset){if(this.constant){const l=this.value;this.value=null,this.setConstantValue(s,l)}else this.setData({value:this.value,constant:this.constant});this.constant=!1}else for(const[l,u]of r){const f=Number.isFinite(l)?this.getVertexOffset(l):0,d=Number.isFinite(u)?this.getVertexOffset(u):a||!Number.isFinite(e)?this.value.length:e*this.size;super.updateSubBuffer({startOffset:f,endOffset:d})}this._checkAttributeArray()}else c=!1;return this.clearNeedsUpdate(),this.setNeedsRedraw(),c}setConstantValue(e,t){var n;if(t===void 0||typeof t=="function")return!1;const s=this.isConstant,r=this.settings.transform&&e?this.settings.transform.call(e,t):t,o=this.settings.defaultType;this.state.constantValue=this._normalizeValue(r,new o(this.size),0);const a=this.setData({constant:!0,value:r});if(this.device.type==="webgpu"){let c=this.state.constantValue;this.doublePrecision&&(c instanceof Float32Array||c instanceof Float64Array)&&(c=Hs(c,{size:this.size}),this.setAccessor({...this.getAccessor(),stride:this.size*2*Float32Array.BYTES_PER_ELEMENT}));let l=this._buffer;(!l||l.byteLength<c.byteLength)&&(l=this._createBuffer(c.byteLength)),l.write(c),(n=this.state).layoutChanged||(n.layoutChanged=!s),this.constant=!1}return a&&this.setNeedsRedraw(),this.clearNeedsUpdate(),!0}getConstantValue(){return this.isConstant?this.state.constantValue:null}setExternalBuffer(e){const{state:t}=this;return e?(this.clearNeedsUpdate(),t.lastExternalBuffer===e||(t.lastExternalBuffer=e,this.setNeedsRedraw(),this.setData(e)),!0):(t.lastExternalBuffer=null,!1)}setBinaryValue(e,t=null){const{state:n,settings:s}=this;if(!e)return n.binaryValue=null,n.binaryAccessor=null,!1;if(s.noAlloc)return!1;if(n.binaryValue===e)return this.clearNeedsUpdate(),!0;if(n.binaryValue=e,this.setNeedsRedraw(),s.transform||t!==this.startIndices){ArrayBuffer.isView(e)&&(e={value:e});const o=e;he(ArrayBuffer.isView(o.value),`invalid ${s.accessor}`);const a=!!o.size&&o.size!==this.size;return n.binaryAccessor=Cm(o.value,{size:o.size||this.size,stride:o.stride,offset:o.offset,startIndices:t,nested:a}),!1}return this.clearNeedsUpdate(),this.setData(e),!0}getVertexOffset(e){const{startIndices:t}=this;return(t?e<t.length?t[e]:this.numInstances:e)*this.size}getValue(){const e=this.settings.shaderAttributes,t=super.getValue();if(!e)return t;for(const n in e)Object.assign(t,super.getValue(n,e[n]));return t}getBufferLayout(e){this.state.layoutChanged=!1;const t=this.settings.shaderAttributes,n=super._getBufferLayout(),{stepMode:s}=this.settings;if(s==="dynamic"?n.stepMode=e?e.isInstanced?"instance":"vertex":"instance":n.stepMode=s??"vertex",!t)return n;for(const r in t){const o=super._getBufferLayout(r,t[r]);n.attributes.push(...o.attributes)}return n}_autoUpdater(e,{data:t,startRow:n,endRow:s,props:r,numInstances:o}){const{settings:a,state:c,value:l,size:u,startIndices:f}=e,{accessor:d,transform:h}=a,g=c.binaryAccessor||(typeof d=="function"?d:r[d]);he(typeof g=="function",`accessor "${d}" is not a function`);let p=e.getVertexOffset(n);const{iterable:m,objectInfo:_}=os(t,n,s);for(const v of m){_.index++;let b=g(v,_);if(h&&(b=h.call(this,b)),f){const x=(_.index<f.length-1?f[_.index+1]:o)-f[_.index];if(b&&Array.isArray(b[0])){let w=p;for(const C of b)e._normalizeValue(C,l,w),w+=u}else b&&b.length>u?l.set(b,p):(e._normalizeValue(b,_.target,0),oL({target:l,source:_.target,start:p,count:x}));p+=x*u}else e._normalizeValue(b,l,p),p+=u}}_validateAttributeUpdaters(){const{settings:e}=this;if(!(e.noAlloc||typeof e.update=="function"))throw new Error(`Attribute ${this.id} missing update or accessor`)}_checkAttributeArray(){const{value:e}=this,t=Math.min(4,this.size);if(e&&e.length>=t){let n=!0;switch(t){case 4:n=n&&Number.isFinite(e[3]);case 3:n=n&&Number.isFinite(e[2]);case 2:n=n&&Number.isFinite(e[1]);case 1:n=n&&Number.isFinite(e[0]);break;default:n=!1}if(!n)throw new Error(`Illegal attribute generated for ${this.id}`)}}}const Am=/^vertex-list<([^<>]+)>$/,Mm=/^value-list<([^<>]+)>$/;function Im(i){return Am.test(i)}function Rm(i){return Mm.test(i)}function eA(i){const e=Am.exec(i),t=Mm.exec(i),n=e?.[1]??t?.[1]??i;try{Ee.getVertexFormatInfo(n)}catch{throw new Error(`Unsupported GPUVector format ${i}`)}return n}function as(i){const e=eA(i),t=Im(i),n=Rm(i),s=Ee.getVertexFormatInfo(e),r=s.type,o=s.normalized,a=tA(r,o);return{format:i,elementFormat:e,vertexList:t,valueList:n,type:r,signedDataType:iA(e,r),primitiveType:a,components:s.components,byteLength:s.byteLength,integer:s.integer,signed:s.signed,normalized:o,...s.webglOnly?{webglOnly:!0}:{}}}function tA(i,e){if(e)return"f32";switch(i){case"float32":return"f32";case"float16":return"f16";case"uint8":case"uint16":case"uint32":return"u32";case"sint8":case"sint16":case"sint32":return"i32";default:throw new Error(`Unsupported GPUVector component type ${i}`)}}function iA(i,e){if(i==="unorm10-10-10-2")return"uint32";switch(e){case"unorm8":return"uint8";case"snorm8":return"sint8";case"unorm16":return"uint16";case"snorm16":return"sint16";default:return e}}class Or{buffer;format;length;byteOffset;byteStride;constructor(e){const t=Ee.getVertexFormatInfo(e.format).byteLength,n=e.byteOffset??0,s=e.byteStride??t;if(ya(e.length,"GPUDataView length"),ya(n,"GPUDataView byteOffset"),ya(s,"GPUDataView byteStride"),s<t)throw new Error(`GPUDataView byteStride ${s} is smaller than ${e.format} byte length ${t}`);const r=e.length===0?0:(e.length-1)*s+t,o=n+r;if(!Number.isSafeInteger(r)||!Number.isSafeInteger(o))throw new Error("GPUDataView byte range must use safe integers");if(o>e.buffer.byteLength)throw new Error("GPUDataView exceeds its backing buffer byte length");this.buffer=e.buffer,this.format=e.format,this.length=e.length,this.byteOffset=n,this.byteStride=s}get elementByteLength(){return Ee.getVertexFormatInfo(this.format).byteLength}get byteLength(){return this.length===0?0:(this.length-1)*this.byteStride+this.elementByteLength}}function ya(i,e){if(!Number.isSafeInteger(i)||i<0)throw new Error(`${e} must be a non-negative safe integer`)}function _a(i){return!!(i&&typeof i=="object"&&i.type==="struct")}function nA(i,e){const t=Object.entries(i);if(t.length===0)throw new Error("GPUData struct format must declare at least one field");return e==="packed"?sA(t):rA(t)}function sA(i){const e=[];let t=0,n=0;for(const[s,r]of i){const o=Ee.getVertexFormatInfo(r);if(o.webglOnly)throw new Error(`Packed GPUData struct field "${s}" uses WebGL-only format ${r}`);t=Ud(t,Math.min(4,o.byteLength)),e.push([s,Object.freeze({format:r,byteOffset:t,byteLength:o.byteLength})]),t+=o.byteLength,n+=o.components}return Object.freeze({type:"struct",layout:"packed",fields:Object.freeze(Object.fromEntries(e)),components:n,byteStride:Ud(t,4),rowByteLength:t})}function rA(i){const e=Object.fromEntries(i.map(([o,a])=>[o,oA(a)])),t=pl(e,{layout:"wgsl-storage"}),n=[];let s=0,r=0;for(const[o,a]of i){const c=Ee.getVertexFormatInfo(a),l=t.fields[o].offset*4;n.push([o,Object.freeze({format:a,byteOffset:l,byteLength:c.byteLength})]),s=Math.max(s,l+c.byteLength),r+=c.components}return Object.freeze({type:"struct",layout:"wgsl-storage",fields:Object.freeze(Object.fromEntries(n)),components:r,byteStride:t.byteLength,rowByteLength:s})}function oA(i){const e=Ee.getVertexFormatInfo(i);switch(e.type){case"float32":return Is("f32",e.components);case"sint32":return Is("i32",e.components);case"uint32":return Is("u32",e.components);default:{const t=Math.ceil(e.byteLength/4);return Is("u32",t)}}}function Is(i,e){return e===1?i:`vec${e}<${i}>`}function Ud(i,e){return Math.ceil(i/e)*e}class aA{buffer;ownsDataBuffer;constructor(e,t){this.buffer=e,this.ownsDataBuffer=t}get ownsBuffer(){return this.ownsDataBuffer}transferBufferOwnership(e){if(e.buffer!==this.buffer)throw new Error("GPUData ownership can only be transferred to the same buffer");e.ownsDataBuffer=this.ownsDataBuffer,this.ownsDataBuffer=!1}destroy(){this.ownsDataBuffer&&(this.buffer.destroy(),this.ownsDataBuffer=!1)}}class cA extends aA{dataType;format;length;valueLength;stride;byteOffset;byteStride;rowByteLength;readbackMetadata;valueOffsets;nullBitmap;valueByteLength;constructor(e){const{buffer:t,format:n,length:s,valueLength:r,stride:o,byteOffset:a=0,byteStride:c,rowByteLength:l,ownsBuffer:u=!1,readbackMetadata:f,valueOffsets:d,nullBitmap:h,valueByteLength:g,dataType:p}=e;super(t,u);let m;n?typeof n=="string"?m=n:m=nA(n,e.layout??"wgsl-storage"):m=void 0;const _=_a(m)?m:void 0,v=typeof m=="string"?as(m):void 0;if(this.dataType=p,this.format=m,this.length=s,this.valueLength=r??s,this.stride=o??v?.components??_?.components??c??l??1,this.byteOffset=a,this.rowByteLength=l??_?.rowByteLength??v?.byteLength??c??this.stride,this.byteStride=c??_?.byteStride??this.rowByteLength,_){if(this.rowByteLength<_.rowByteLength)throw new Error(`GPUData rowByteLength ${this.rowByteLength} is smaller than struct format row byte length ${_.rowByteLength}`);if(this.byteStride<Math.max(_.byteStride,this.rowByteLength))throw new Error(`GPUData byteStride ${this.byteStride} is smaller than its struct row layout`)}this.readbackMetadata=f,this.valueOffsets=d,this.nullBitmap=h,this.valueByteLength=g}getChild(e){if(!_a(this.format))return null;const t=this.format.fields[e];return t?new Or({buffer:this.buffer,format:t.format,length:this.length,byteOffset:this.byteOffset+t.byteOffset,byteStride:this.byteStride}):null}getChildAt(e){if(!_a(this.format))return null;const t=Object.values(this.format.fields)[e];return t?new Or({buffer:this.buffer,format:t.format,length:this.length,byteOffset:this.byteOffset+t.byteOffset,byteStride:this.byteStride}):null}}const Ac=cA;class Fn{name;dataType;format;length;valueLength;stride;byteOffset;byteStride;rowByteLength;bufferLayout;data=[];device;bufferProps;isAppendable=!1;ownsDataChunks=!0;ownedVectors=[];appendableByteLength=0;constructor(e){switch(e.type){case"buffer":{const{name:t,buffer:n,format:s,length:r,valueLength:o=r,byteOffset:a=0,ownsBuffer:c=!1}=e,{stride:l,byteStride:u,rowByteLength:f}=$d(e);this.name=t,this.dataType=e.dataType,this.format=s,this.length=r,this.valueLength=o,this.stride=l,this.byteOffset=a,this.byteStride=u,this.rowByteLength=f,this.data.push(new Ac({buffer:n,format:s,length:r,valueLength:o,stride:l,byteOffset:a,byteStride:u,rowByteLength:f,ownsBuffer:c,dataType:e.dataType}));return}case"interleaved":{const{name:t,buffer:n,format:s,length:r,valueLength:o=r,byteOffset:a=0,byteStride:c,attributes:l,ownsBuffer:u=!1}=e;this.name=t,this.dataType=e.dataType,this.format=s,this.length=r,this.valueLength=o,this.stride=c,this.byteOffset=a,this.byteStride=c,this.rowByteLength=c,this.bufferLayout={name:t,byteStride:c,attributes:l},this.data.push(new Ac({buffer:n,format:s,length:r,valueLength:o,stride:c,byteOffset:a,byteStride:c,rowByteLength:c,ownsBuffer:u,dataType:e.dataType}));return}case"data":{const t=e.format??lA(e.data),n=t?as(t):void 0,{name:s,data:r,stride:o=r[0]?.stride??n?.components??1,valueLength:a=r.reduce((d,h)=>d+h.valueLength,0),byteStride:c=r[0]?.byteStride??n?.byteLength,rowByteLength:l=r[0]?.rowByteLength??n?.byteLength,bufferLayout:u,ownsData:f=!1}=e;if(c===void 0||l===void 0)throw new Error("GPUVector requires format or explicit byte layout metadata");t&&uA(r,t),this.name=s,this.dataType=e.dataType,this.format=t,this.length=r.reduce((d,h)=>d+h.length,0),this.valueLength=a,this.stride=o,this.byteOffset=r.length===1?r[0].byteOffset:0,this.byteStride=c,this.rowByteLength=l,this.bufferLayout=u,this.ownsDataChunks=f,this.data.push(...r);return}case"appendable":{const{name:t,device:n,format:s,valueLength:r=0,bufferProps:o}=e,{stride:a,byteStride:c,rowByteLength:l}=$d(e);this.name=t,this.dataType=e.dataType,this.format=s,this.length=0,this.valueLength=r,this.stride=a,this.byteOffset=0,this.byteStride=c,this.rowByteLength=l,this.device=n,this.bufferProps=o,this.isAppendable=!0;return}}}get ownsBuffer(){return this.ownsDataChunks&&this.data.some(e=>e.ownsBuffer)||this.ownedVectors.some(e=>e.ownsBuffer)}get capacityRows(){return this.isAppendable?this.length:void 0}get appendedByteLength(){return this.appendableByteLength}addData(e){if(this.format&&e.format!==this.format)throw new Error("GPUVector.addData() requires matching formats");if(e.byteStride!==this.byteStride)throw new Error("GPUVector.addData() requires matching byteStride");if(e.rowByteLength!==this.rowByteLength)throw new Error("GPUVector.addData() requires matching rowByteLength");return this.data.push(e),this.length+=e.length,this.valueLength+=e.valueLength,this}appendDataChunk(e,t=this.appendableByteLength+e.buffer.byteLength){if(!this.isAppendable)throw new Error("GPUVector.appendDataChunk() requires appendable vector storage");if(this.format&&e.format!==this.format)throw new Error("GPUVector.appendDataChunk() requires matching formats");if(e.byteStride!==this.byteStride||e.rowByteLength!==this.rowByteLength)throw new Error("GPUVector.appendDataChunk() requires matching byte layout metadata");return this.data.push(e),this.length+=e.length,this.valueLength+=e.valueLength,this.appendableByteLength=t,this}resetLastBatch(){if(!this.isAppendable)throw new Error("GPUVector.resetLastBatch() requires appendable vector storage");for(const e of this.data.splice(0))e.destroy();return this.length=0,this.valueLength=0,this.appendableByteLength=0,this}retainOwnedVectors(e){return this.ownedVectors.push(...e),this}transferBufferOwnership(e){const t=this.data[0],n=e.data[0];if(!t||!n||t.buffer!==n.buffer)throw new Error("GPUVector ownership can only be transferred to the same buffer");t.transferBufferOwnership(n)}destroy(){if(this.ownsDataChunks)for(const e of this.data)e.destroy();for(const e of this.ownedVectors.splice(0))e.destroy()}}function $d(i){const e=i.format?as(i.format):void 0,t=i.rowByteLength??i.byteStride??e?.byteLength;if(t===void 0)throw new Error("GPUVector requires format or explicit rowByteLength");return{stride:i.stride??e?.components??1,byteStride:i.byteStride??t,rowByteLength:t}}function lA(i){return i[0]?.format}function uA(i,e){if(i.find(n=>n.format!==e))throw new Error("GPUVector data chunks must share the declared format")}class fA{poolSize=20;bufferPools;constructor(){this.bufferPools=new Map}createOrReuse(e,t){if(t>e.limits.maxBufferSize)throw new Error(`Buffer pool cannot allocate ${t} bytes: device.limits.maxBufferSize is ${e.limits.maxBufferSize}`);const n=this.bufferPools.get(e),s=n?n.findIndex(o=>o.byteLength>=t):-1;if(s<0)return e.createBuffer({usage:q.VERTEX|q.STORAGE|q.COPY_DST|q.COPY_SRC,byteLength:t});const[r]=n.splice(s,1);return r}recycle(e){const t=e.device;this.bufferPools.has(t)||this.bufferPools.set(t,[]);const n=this.bufferPools.get(t),s=n.findIndex(r=>r.byteLength>e.byteLength);s<0?n.push(e):n.splice(s,0,e),this.purge()}purge(){for(const[e,t]of this.bufferPools){const n=e.isLost?0:this.poolSize;for(;t.length>n;)t.shift().destroy();t.length===0&&this.bufferPools.delete(e)}}}const yn=new fA;class ge{static get bufferPoolSize(){return yn.poolSize}static set bufferPoolSize(e){if(!Number.isSafeInteger(e)||e<0)throw new Error("GPUDataEvaluator.bufferPoolSize must be a non-negative safe integer");yn.poolSize=e,yn.purge()}type;size;get offset(){return this._offset}get stride(){return this._stride}normalized;isConstant;length;get byteLength(){return this._byteLength}ValueType;source=null;format;_id;_destroyed=!1;_value;_offset;_stride;_byteLength;_gpuVector;_bufferOwnership="owned";_targetBuffer;static fromArray(e,{type:t,size:n=1,offset:s=0,stride:r=0,normalized:o=!1}){let a=t,c;if(Array.isArray(e)){a=a||"float32";const u=Mn(a);c=new u(e)}else e instanceof Float64Array?(a="uint32",n*=2,s*=2,r*=2,c=new Uint32Array(e.buffer,e.byteOffset,e.byteLength/4)):(a=a||Wg(e),c=e);const l=`<${a} * ${n}>`;return new ge({id:l,type:a,size:n,offset:s,stride:r,normalized:o,value:c})}static fromConstant(e,t="float32"){const n=Mn(t);let s;return Array.isArray(e)?s=`[${e.join(",")}]`:(s=String(e),e=[e]),new ge({id:s,isConstant:!0,type:t,size:e.length,value:new n(e)})}static fromGPUData(e,t={}){hA(e);const n=new Or({buffer:e.buffer,format:e.format,length:e.length,byteOffset:e.byteOffset,byteStride:e.byteStride});return new ge({...Vd(n),id:t.id,gpuData:e})}static fromGPUDataView(e,t={}){return new ge({...Vd(e),id:t.id,buffer:e.buffer})}constructor(e){const{id:t,value:n,buffer:s,gpuData:r,format:o,source:a=null,isConstant:c=!1}=e;if(!a&&!n&&!s&&!r)throw new Error("GPUDataEvaluator must have a value source");let{type:l,size:u,offset:f,stride:d,normalized:h,length:g}=e;if(a instanceof ge?(l=l??a.type,u=u??a.size,f=f??a.offset,d=d??a.stride,h=h??a.normalized,g=g??a.length):(u=u??1,f=f??0,h=h??!1,g=c?1:g),!l)throw new Error("GPUDataEvaluator: type not defined");if(this._id=t,this.type=l,this.size=u,this.ValueType=Mn(this.type),this._offset=f,this._stride=d||this.ValueType.BYTES_PER_ELEMENT*u,this.normalized=h,this.source=a,this.format=o,g===void 0)if(c)g=1;else{if(!n)throw new Error("GPUDataEvaluator: length not defined");g=Math.ceil(n.byteLength/this.stride)}this.isConstant=c,this.length=g;const p=this.ValueType.BYTES_PER_ELEMENT*this.size;this._byteLength=g===0?0:(g-1)*this.stride+p,this._value=n,this._bufferOwnership=a instanceof ge||s||r?"borrowed":"owned",r?this._gpuVector=new Fn({type:"data",name:this._id??"data",format:r.format,data:[r],stride:r.stride,byteStride:r.byteStride,rowByteLength:r.rowByteLength}):s&&(this._gpuVector=this.createGPUVectorView({buffer:s,name:this._id,format:this.format}))}get value(){return this._value||(this.source instanceof ge?this.source.value:void 0)}get evaluated(){return!!this._gpuVector}get id(){return this._id}get gpuVector(){if(!this._gpuVector)throw new Error(`${this} not evaluated`);return this._gpuVector}get buffer(){return Rs(this.gpuVector)}setTargetBuffer({buffer:e,byteOffset:t=0,byteStride:n=this.stride}){if(this._destroyed)throw new Error(`GPUDataEvaluator ${this} already destroyed`);if(this._gpuVector)throw new Error(`GPUDataEvaluator ${this} already evaluated`);if(!this.source||this.source instanceof ge)throw new Error("GPUDataEvaluator target buffers require a deferred operation source");this._targetBuffer={buffer:e,byteOffset:t,byteStride:n}}async evaluate(e,t={}){if(this._destroyed)throw new Error(`GPUDataEvaluator ${this} already destroyed`);if(this._gpuVector)return this._gpuVector;let n;if(this.source instanceof ge){const s=await this.source.evaluate(e);return this._gpuVector=this.createGPUVectorView({...t,buffer:Rs(s)}),this._gpuVector}if(n=this._getEvaluationBuffer(e),this._value)n.write(this._value);else{const s=await this.source.execute(e,n);if(!s.success)throw s.error||new Error(`${this.source} evaluation failed`);s.value&&(this._value=s.value)}return this._gpuVector=this.createGPUVectorView({...t,buffer:n}),this._gpuVector}evaluateSync(e,t={}){if(this._destroyed)throw new Error(`GPUDataEvaluator ${this} already destroyed`);if(this._gpuVector)return this._gpuVector;let n;if(this.source instanceof ge){const s=this.source.evaluateSync(e);return this._gpuVector=this.createGPUVectorView({...t,buffer:Rs(s)}),this._gpuVector}if(n=this._getEvaluationBuffer(e),this._value)n.write(this._value);else{const s=this.source.executeSync(e,n);if(!s.success)throw s.error||new Error(`${this.source} evaluation failed`);s.value&&(this._value=s.value)}return this._gpuVector=this.createGPUVectorView({...t,buffer:n}),this._gpuVector}createGPUVectorView(e){const t=e.name??this._id??"vector",n=e.format??this.format??mA(this.type,this.size,this.normalized);if(e.interleaved){const s=typeof e.interleaved=="object"&&e.interleaved.attributes?e.interleaved.attributes:pA(this);return new Fn({type:"interleaved",name:t,buffer:e.buffer,format:e.format??this.format,length:this.length,byteOffset:this.offset,byteStride:this.stride,attributes:s,ownsBuffer:!1})}return new Fn({type:"buffer",name:t,buffer:e.buffer,format:n,length:this.length,stride:this.size,byteOffset:this.offset,byteStride:this.stride,rowByteLength:this.ValueType.BYTES_PER_ELEMENT*this.size,ownsBuffer:!1})}_getEvaluationBuffer(e){const t=this._targetBuffer;if(!t)return yn.createOrReuse(e,this.byteLength);if(t.buffer.device!==e)throw new Error("GPUDataEvaluator target buffer belongs to a different device");const n=this.ValueType.BYTES_PER_ELEMENT*this.size,s=this.length===0?0:(this.length-1)*t.byteStride+n;if(t.byteOffset+s>t.buffer.byteLength)throw new Error("GPUDataEvaluator target buffer is too small for the output layout");return this._offset=t.byteOffset,this._stride=t.byteStride,this._byteLength=s,this._bufferOwnership="borrowed",this._targetBuffer=void 0,t.buffer}async readValue(e=0,t){const{ValueType:n}=this,{size:s,offset:r,stride:o,length:a}=this,c=n.BYTES_PER_ELEMENT*s;if(t=t??a,e=Math.max(0,Math.min(a,e)),t=Math.max(e,Math.min(a,t)),this._value)return dA(this,this._value,e,t);const l=t-e;if(l===0)return new n(0);const u=r+e*o,f=o===c?l*c:(l-1)*o+c,d=await this.buffer.readAsync(u,f),h=new n(d.buffer,d.byteOffset,d.byteLength/n.BYTES_PER_ELEMENT);if(o===c)return h;const g=new Uint8Array(c*l);for(let p=0;p<l;p++){const m=p*o;g.set(d.subarray(m,m+c),p*c)}return new n(g.buffer)}async ensureCPUValue(){const e=this.value;if(e)return e;const t=await this.buffer.readAsync(0,this.offset+this.byteLength);if(t.byteLength%this.ValueType.BYTES_PER_ELEMENT!==0)throw new Error(`${this} backing buffer byte length is not aligned to its scalar type`);const n=t.slice();return this._value=new this.ValueType(n.buffer,n.byteOffset,n.byteLength/this.ValueType.BYTES_PER_ELEMENT),this._value}ensureCPUValueSync(){const e=this.value;if(e)return e;throw new Error(`${this} CPU value is not available for synchronous evaluation`)}toString(){return this._id??this.source?.toString()??this.constructor.name}destroy(){this._gpuVector&&(this._bufferOwnership==="owned"&&yn.recycle(Rs(this._gpuVector)),this._gpuVector=void 0),this._targetBuffer=void 0,this._destroyed=!0}}function dA(i,e,t,n){const{ValueType:s,size:r,offset:o,stride:a}=i,c=a/s.BYTES_PER_ELEMENT,l=o/s.BYTES_PER_ELEMENT,u=n-t;if(c===r){const d=l+t*c;return e.subarray(d,d+u*r)}const f=new s(u*r);for(let d=0;d<u;d++){const h=l+(t+d)*c;f.set(e.subarray(h,h+r),d*r)}return f}function Gd(i){if(i instanceof ge)return i;if(typeof i=="number"||Array.isArray(i))return ge.fromConstant(i);if(i instanceof Ac)return ge.fromGPUData(i);if(i instanceof Or)return ge.fromGPUDataView(i);throw new Error("getGPUDataEvaluator() requires GPUDataEvaluator, GPUData, GPUDataView, number, or number[]")}function hA(i){if(!i.format)throw new Error("GPUDataEvaluator.fromGPUData() requires GPUData format metadata");if(Im(i.format)||Rm(i.format))throw new Error("GPUDataEvaluator.fromGPUData() does not support variable-length input");const t=as(i.format).byteLength;if(i.rowByteLength!==t)throw new Error(`GPUDataEvaluator.fromGPUData() requires rowByteLength ${t} for GPUData`)}function Vd(i){const e=as(i.format),t=Mn(e.signedDataType),n=t.BYTES_PER_ELEMENT*e.components;if(e.byteLength!==n)throw new Error(`GPUDataEvaluator does not support packed vertex format ${i.format}: ${e.byteLength} physical bytes cannot expose ${e.components} ${e.signedDataType} components`);if(i.byteOffset%t.BYTES_PER_ELEMENT!==0||i.byteStride%t.BYTES_PER_ELEMENT!==0)throw new Error(`GPUDataEvaluator requires ${i.format} offset and stride aligned to ${t.BYTES_PER_ELEMENT} bytes`);return{type:e.signedDataType,size:e.components,offset:i.byteOffset,stride:i.byteStride,normalized:e.normalized,length:i.length,format:i.format}}function Rs(i){const e=gA(i).buffer;return e instanceof ct?e.buffer:e}function gA(i){const[e,...t]=i.data;if(!e||t.length>0)throw new Error(`GPUDataEvaluator requires exactly one GPUData chunk for "${i.name}"`);return e}function pA(i){const e=[];return Om(i,e,{byteOffset:0}),e}function Om(i,e,t){const n=i.source;if(n&&!(n instanceof ge)&&n.name==="interleave"){for(const s of Object.values(n.inputs))s instanceof ge&&Om(s,e,t);return}e.push({attribute:i.id??i.toString(),format:km(i.type,i.size,i.normalized),byteOffset:t.byteOffset}),t.byteOffset+=i.ValueType.BYTES_PER_ELEMENT*i.size}function km(i,e,t=!1){if(e<1||e>4)throw new Error(`Cannot synthesize a GPUVector vertex format with ${e} components`);let n=i;if(t)switch(i){case"uint8":n="unorm8";break;case"sint8":n="snorm8";break;case"uint16":n="unorm16";break;case"sint16":n="snorm16";break;case"float32":n="float32";break;default:throw new Error(`Unsupported normalized vertex format for ${i}`)}return(n==="uint8"||n==="sint8"||n==="uint16"||n==="sint16"||n==="unorm8"||n==="snorm8"||n==="unorm16"||n==="snorm16")&&e===3?`${n}x3-webgl`:`${n}${e===1?"":`x${e}`}`}function mA(i,e,t=!1){return e>=1&&e<=4?km(i,e,t):void 0}class Vi{gpuDataEvaluators;format;length;id;_gpuVector;_ownsGPUDataEvaluators;_destroyed=!1;static fromGPUVector(e){if(e.bufferLayout)throw new Error(`GPUVectorEvaluator.fromGPUVector() does not accept interleaved vector "${e.name}"`);if(e.data.length===0)throw new Error(`GPUVectorEvaluator.fromGPUVector() requires GPUData for "${e.name}"`);return new Vi({id:e.name,gpuDataEvaluators:e.data.map(t=>ge.fromGPUData(t,{id:e.name})),gpuVector:e,format:e.format})}static fromGPUDataEvaluators(e,t={}){return new Vi({id:t.id,gpuDataEvaluators:e,format:t.format})}constructor({id:e,gpuDataEvaluators:t,gpuVector:n,format:s}){if(t.length===0)throw new Error("GPUVectorEvaluator requires at least one GPUData evaluator");yA(t),this.id=e,this.gpuDataEvaluators=t,this.format=s??t[0].format,this.length=t.reduce((r,o)=>r+o.length,0),this._gpuVector=n,this._ownsGPUDataEvaluators=!n}get evaluated(){return!!this._gpuVector}get gpuVector(){if(!this._gpuVector)throw new Error(`${this} not evaluated`);return this._gpuVector}mapGPUData(e){return Vi.fromGPUDataEvaluators(this.gpuDataEvaluators.map((t,n)=>e(t,n)),{id:this.id})}async evaluate(e,t={}){if(this._destroyed)throw new Error(`GPUVectorEvaluator ${this} already destroyed`);if(this._gpuVector)return this._gpuVector;const n=await Promise.all(this.gpuDataEvaluators.map(a=>a.evaluate(e,t))),s=n[0],r=n.map(jd),o=t.format??this.format??s.format;return this._gpuVector=new Fn({type:"data",name:t.name??this.id??"vector",format:o,data:r,stride:s.stride,byteStride:s.byteStride,rowByteLength:s.rowByteLength,bufferLayout:s.bufferLayout}),this._gpuVector}evaluateSync(e,t={}){if(this._destroyed)throw new Error(`GPUVectorEvaluator ${this} already destroyed`);if(this._gpuVector)return this._gpuVector;const n=this.gpuDataEvaluators.map(a=>a.evaluateSync(e,t)),s=n[0],r=n.map(jd),o=t.format??this.format??s.format;return this._gpuVector=new Fn({type:"data",name:t.name??this.id??"vector",format:o,data:r,stride:s.stride,byteStride:s.byteStride,rowByteLength:s.rowByteLength,bufferLayout:s.bufferLayout}),this._gpuVector}destroy(){if(this._ownsGPUDataEvaluators)for(const e of this.gpuDataEvaluators)e.destroy();this._gpuVector=void 0,this._destroyed=!0}toString(){return this.id??this.constructor.name}}function yA(i){const e=i[0];for(const t of i.slice(1))if(t.type!==e.type||t.size!==e.size||t.normalized!==e.normalized||t.format!==e.format)throw new Error("GPUVectorEvaluator requires matching GPUData evaluator layouts")}function jd(i){const[e,...t]=i.data;if(!e||t.length>0)throw new Error(`GPUVectorEvaluator requires one GPUData chunk for "${i.name}"`);return e}const _A={add:{arity:2,symbol:"arithmetic_add"},subtract:{arity:2,symbol:"arithmetic_subtract"},multiply:{arity:2,symbol:"arithmetic_multiply"},divide:{arity:2,symbol:"arithmetic_divide"},pow:{arity:2,symbol:"pow"},sqrt:{arity:1,symbol:"sqrt"},abs:{arity:1,symbol:"abs"},sin:{arity:1,symbol:"sin"},cos:{arity:1,symbol:"cos"},tan:{arity:1,symbol:"arithmetic_tan"},exp:{arity:1,symbol:"exp"},log:{arity:1,symbol:"log"}};function Xl({elementWise:i,func:e,inputs:t,output:n,outputBuffer:s}){const r=Array.isArray(t)?t:Object.values(t);for(const g of r)if(!g.value)throw new Error(`${g} does not have CPU value`);const o=n.length,a=n.size,c=new n.ValueType(o*a);for(let g=0;g<o;g++){const p=r.map(m=>Be(m,g));if(i)for(let m=0;m<a;m++)c[g*a+m]=e.apply(null,p.map(_=>_[m]));else e.call(null,c.subarray(g*a,g*a+a),...p)}const l=n.ValueType.BYTES_PER_ELEMENT,u=n.offset/l,f=n.stride/l,d=a;let h=c;if(u!==0||f!==d){h=new n.ValueType(u+n.byteLength/l);for(let g=0;g<o;g++){const p=g*d,m=u+g*f,_=c.subarray(p,p+a);h.set(_,m),s.write(_,m*l)}}else s.write(c);return{success:!0,value:h}}function Be(i,e){const t=i.value,n=i.size,s=i.offset/i.ValueType.BYTES_PER_ELEMENT,r=i.stride/i.ValueType.BYTES_PER_ELEMENT,o=i.isConstant?0:e,a=s+o*r,c=t.slice(a,a+n);if(!i.normalized)return c;const l=new Float32Array(n);for(let u=0;u<n;u++)l[u]=bA(c[u],i.type);return l}function bA(i,e){switch(e){case"uint8":return i/255;case"uint16":return i/65535;case"uint32":return i/4294967295;case"sint8":return Math.max(i/127,-1);case"sint16":return Math.max(i/32767,-1);case"sint32":return Math.max(i/2147483647,-1);case"float32":return i;default:throw new Error(`Unsupported normalized source type ${e}`)}}const vA=({inputs:i,output:e,target:t})=>{for(const s of Object.values(i.namedInputs))if(!s.value)throw new Error(`${s} does not have CPU value`);const n=new e.ValueType(e.length*e.size);for(let s=0;s<e.length;s++){const r=Object.fromEntries(Object.entries(i.namedInputs).map(([o,a])=>[o,Be(a,s)]));for(let o=0;o<e.size;o++)n[s*e.size+o]=Bm(i.expression,r,o)}return t.write(n),{success:!0,value:n}};function Bm(i,e,t){switch(i.kind){case"input":{const n=e[i.name];return t<n.length?n[t]:n.length===1?n[0]:0}case"literal":return Array.isArray(i.value)?i.value[t]??0:i.value;case"call":{xA(i.op,i.args.length);const n=i.args.map(s=>Bm(s,e,t));switch(i.op){case"add":return n[0]+n[1];case"subtract":return n[0]-n[1];case"multiply":return n[0]*n[1];case"divide":return n[0]/n[1];case"pow":return Math.pow(n[0],n[1]);case"sqrt":return Math.sqrt(n[0]);case"abs":return Math.abs(n[0]);case"sin":return Math.sin(n[0]);case"cos":return Math.cos(n[0]);case"tan":return Math.tan(n[0]);case"exp":return Math.exp(n[0]);case"log":return Math.log(n[0]);default:{const s=i.op;throw new Error(`Unsupported arithmetic op ${s}`)}}}default:{const n=i;throw new Error(`Unsupported expression node ${n.kind}`)}}}function xA(i,e){const t=_A[i].arity;if(e!==t)throw new Error(`Arithmetic op '${i}' expects ${t} args, got ${e}`)}const wA=({inputs:i,output:e,target:t})=>{const{sourceValues:n}=i;if(!n.value)throw new Error(`${n} does not have CPU value`);const r=new e.ValueType(e.length*e.size);if(n.length===0)return{success:!1,error:new Error(`${n} is empty`)};for(let o=0;o<n.size;o++){const a=Be(n,0)[o],c=o*e.size,l=c+1;r[c]=a,r[l]=a;for(let u=1;u<n.length;u++){const f=Be(n,u)[o];f<r[c]&&(r[c]=f),f>r[l]&&(r[l]=f)}}return t.write(r),{success:!0,value:r}},PA=({inputs:i,output:e,target:t})=>Xl({func:(n,s)=>{const r=n.length/2,o=new Float64Array(s.buffer);for(let a=0;a<r;a++){const c=o[a];n[a]=Math.fround(c),n[a+r]=c-n[a]}return n},inputs:i,output:e,outputBuffer:t}),SA=async({inputs:i,output:e,target:t})=>{const{ids:n,sourceValues:s}=i,r=n.value,o=s.value;if(!r)throw new Error(`${n} does not have CPU value`);if(!o)throw new Error(`${s} does not have CPU value`);const a=new e.ValueType(e.length*e.size),c=new Array(e.size).fill(0);for(let l=0;l<e.length;l++){const u=Be(n,l),f=Number(u[0]),d=EA(f,s.length)?Be(s,f):c;a.set(d,l*e.size)}return t.write(a),{success:!0,value:a}};function EA(i,e){return Number.isInteger(i)&&i>=0&&i<e}const CA=({inputs:i,output:e,target:t})=>Xl({func:(n,...s)=>{let r=0;for(const o of s)n.set(o,r),r+=o.length},inputs:i,output:e,outputBuffer:t}),LA=({inputs:i,output:e,target:t})=>{const{x:n,y:s}=i,r=new e.ValueType(e.length);for(let o=0;o<e.length;o++){const a=Be(n,o),c=Be(s,o);let l=0;for(let u=0;u<n.size;u++)l+=a[u]*c[u];r[o]=l}return t.write(r),{success:!0,value:r}},TA=({inputs:i,output:e,target:t})=>{const{x:n,y:s}=i,r=new e.ValueType(e.length);for(let o=0;o<e.length;o++){const a=Be(n,o),c=Be(s,o);let l=1;for(let u=0;u<n.size;u++)if(a[u]!==c[u]){l=0;break}r[o]=l}return t.write(r),{success:!0,value:r}},AA=({inputs:i,output:e,target:t})=>{const{x:n}=i,s=new e.ValueType(e.length);for(let r=0;r<e.length;r++){const o=Be(n,r);let a=0;for(let c=0;c<n.size;c++)a+=o[c]*o[c];s[r]=Math.sqrt(a)}return t.write(s),{success:!0,value:s}},MA=async({inputs:i,output:e,target:t})=>{const{segments:n,vertexCount:s}=i,r=n.value;if(!r)throw new Error(`${n} does not have CPU value`);IA(r,n,s);const o=new e.ValueType(e.length*e.size);let a=0;for(let c=0;c<s;c++){for(;a+1<n.length&&r[Mc(n,a+1)]<=c;)a++;const l=r[Mc(n,a)],u=c*e.size;o[u]=a,o[u+1]=c-l}return t.write(o),{success:!0,value:o}};function IA(i,e,t){if(e.length<1)throw new Error("segmentedMap segments must contain at least one segment start");let n=0;for(let s=0;s<e.length;s++){const r=i[Mc(e,s)];if(s===0&&r!==0)throw new Error(`segmentedMap segments must start at 0, got ${r}`);if(s>0&&r<n)throw new Error(`segmentedMap segments must be non-decreasing, got ${r} after ${n}`);n=r}if(n>t)throw new Error(`segmentedMap last segment start must be <= vertexCount, got ${n} > ${t}`)}function Mc(i,e){return i.offset/i.ValueType.BYTES_PER_ELEMENT+e*(i.stride/i.ValueType.BYTES_PER_ELEMENT)}const RA=async({inputs:i,output:e,target:t})=>{const{condition:n,whenTrue:s,whenFalse:r}=i,o=new e.ValueType(e.length*e.size);for(let a=0;a<e.length;a++){const c=Be(n,a),l=Be(s,a),u=Be(r,a);for(let f=0;f<e.size;f++){const d=ba(c,n.size,f);o[a*e.size+f]=d!==0?ba(l,s.size,f):ba(u,r.size,f)}}return t.write(o),{success:!0,value:o}};function ba(i,e,t){return t<e?i[t]:e===1?i[0]:0}const OA=({inputs:i,output:e,target:t})=>{const n=new e.ValueType(e.length);for(let s=0;s<e.length;s++)n[s]=i.start+s*i.step;return t.write(n),{success:!0,value:n}},kA=({inputs:i,output:e,target:t})=>{const{columns:n}=i;return Xl({func:(s,r)=>{for(let o=0;o<n.length;o++)s[o]=r[n[o]]},inputs:{x:i.x},output:e,outputBuffer:t})},BA=Object.freeze(Object.defineProperty({__proto__:null,arithmetic:vA,dot:LA,equalAll:TA,extent:wA,fround:PA,gather:SA,interleave:CA,length:AA,segmentedMap:MA,select:RA,sequence:OA,swizzle:kA},Symbol.toStringTag,{value:"Module"}));class DA{_modules={cpu:BA};add(e,t){const n=this._modules[e];if(typeof t.then=="function"){const r=Promise.all([Promise.resolve(n||{}),t]).then(([o,a])=>({...o,...a}));return this._modules[e]=r,r.then(o=>{this._modules[e]=o}).catch(o=>{A.error(`Failed to register ${e} backend: ${o}`)()}),r}if(n&&typeof n.then=="function"){const r=Promise.resolve(n).then(o=>({...o,...t})).then(o=>(this._modules[e]=o,o)).catch(o=>{throw A.error(`Failed to register ${e} backend: ${o}`)(),o});return this._modules[e]=r,r}const s={...n||{},...t};return this._modules[e]=s,Promise.resolve(s)}async get(e,t){let n=this._modules[e];if(!n)if(e==="webgl")n=this.add("webgl",ir(()=>import("./index-BypCt1wZ.js"),__vite__mapDeps([0,1,2,3,4,5,6,7,8,9,10,11,12,13,14])));else if(e==="webgpu")n=this.add("webgpu",ir(()=>import("./index-CPdkqp3I.js"),__vite__mapDeps([15,1,2,3,4,5,6,7,8,9,10,11,12,13,14])));else throw new Error(`${e} backend not registered`);const r=(await n)[t];if(typeof r!="function")throw new Error(`${e} backend does not implement ${t}`);return r}getSync(e,t){const n=this._modules[e];if(!n)throw new Error(`${e} backend not registered`);if(typeof n.then=="function")throw new Error(`${e} backend is not loaded yet`);const r=n[t];if(typeof r!="function")throw new Error(`${e} backend does not implement ${t}`);return r}clear(){this._modules={}}}const Ic=new DA;class FA{inputs;dependencies;constructor(e){this.inputs=e,this.dependencies=Array.from(e instanceof Array?e:Object.values(e)).filter(t=>t instanceof ge)}async execute(e,t){return await this._resolveDependencies(e),await this._executeWithHandler(await Ic.get(this._getHandlerRegistry(e),this.name),t)}executeSync(e,t){this._resolveDependenciesSync(e);const n=this._executeWithHandler(Ic.getSync(this._getHandlerRegistry(e),this.name),t);if(zA(n))throw new Error(`${this.name} returned a Promise in executeSync()`);return n}shouldExecuteOnCPU(){return this.output.length<=1&&Array.from(this.dependencies).every(e=>!!e.value)}_getHandlerRegistry(e){return this.shouldExecuteOnCPU()?"cpu":e.type}async _resolveDependencies(e){for(const n of this.dependencies)await n.evaluate(e);if(this._getHandlerRegistry(e)==="cpu"||e.type==="null")for(const n of this.dependencies)await n.ensureCPUValue()}_resolveDependenciesSync(e){for(const n of this.dependencies)n.evaluateSync(e);if(this._getHandlerRegistry(e)==="cpu"||e.type==="null")for(const n of this.dependencies)n.ensureCPUValueSync()}_executeWithHandler(e,t){return e({device:t.device,inputs:this.inputs,output:this.output,target:t})}}function zA(i){return typeof i?.then=="function"}function NA(...i){let e=UA(i.map(t=>t.type));return e[0]!=="f"&&i.some(t=>t.normalized)&&(e="float32"),{isConstant:i.every(t=>t.isConstant),type:e,size:i.reduce((t,n)=>Math.max(t,n.size),0),length:i.reduce((t,n)=>Math.max(t,n.length),0)}}function UA(i){let e=0,t=0;for(const n of i){if(n[0]==="f")return"float32";const s=n.endsWith("8")?8:n.endsWith("6")?16:32;n[0]==="u"?e=Math.max(e,s):t=Math.max(t,s)}return e&&!t?`uint${e}`:t&&e<32?`sint${Math.max(t,e*2)}`:"float32"}class $A extends FA{name="interleave";output;constructor(e){super(e);const{isConstant:t,type:n,length:s}=NA(...e);this.output=new ge({isConstant:t,type:n,size:e.reduce((r,o)=>r+o.size,0),length:s,source:this})}toString(){return`_${this.inputs.join("_")}_`}}function GA(...i){if(i.length===0)throw new Error("interleave() requires at least one input");return i.length===1?Gd(i[0]):new $A(i.map(Gd)).output}function VA(i,e){const t=WA(e);for(const n of t)n.evaluateSync(i);return jA(t),e}function jA(i){const e=new Set(i.flatMap(YA)),t=new Set;for(const n of i)Zs(n,t);for(const n of t)n.evaluated&&!e.has(n.buffer)&&n.destroy()}function WA(i){const e=new Set;return Rc(i,e,new Set),Array.from(e)}function Rc(i,e,t){if(qA(i)){e.add(i);return}if(!(!i||typeof i!="object"||t.has(i))){if(t.add(i),Array.isArray(i)){for(const n of i)Rc(n,e,t);return}if(HA(i))for(const n of Object.values(i))Rc(n,e,t)}}function HA(i){const e=Object.getPrototypeOf(i);return e===Object.prototype||e===null}function Zs(i,e){if(i instanceof Vi){for(const n of i.gpuDataEvaluators)Zs(n,e);return}const t=i.source;if(t){if(t instanceof ge){e.has(t)||(e.add(t),Zs(t,e));return}for(const n of t.dependencies)e.has(n)||(e.add(n),Zs(n,e))}}function YA(i){return i instanceof ge?[i.buffer]:i.gpuVector.data.map(e=>e.buffer instanceof ct?e.buffer.buffer:e.buffer)}function qA(i){return i instanceof ge||i instanceof Vi}const ZA=65535;function XA(i,e){const t=JA(e),n=Math.max(1,Math.ceil(i)),s=Math.min(n,t),r=Math.min(Math.ceil(n/s),t),o=Math.ceil(n/s/r);if(o>t)throw new Error(`WebGPU dispatch requires ${n} workgroups, exceeding the 3D dispatch limit of ${t} per dimension`);return{x:s,y:r,z:o}}function KA(i,e="workgroupId"){return`((${e}.z * ${i.y}u + ${e}.y) * ${i.x}u + ${e}.x)`}function QA(i,e,t="workgroupId",n="localId"){return`(${KA(i,t)} * ${e}u + ${n}.x)`}function JA(i){return Number.isFinite(i)&&i>0?Math.floor(i):ZA}function Oc(i,e){switch(i){case"u32":return`${e}u`;case"f32":return Number.isInteger(e)?`${e}.0`:`${e}`;default:return`${e}`}}function Hk(i,e){switch(i){case"uint32":return Oc("u32",Math.trunc(e));case"sint32":return`${Math.trunc(e)}`;case"float32":return Oc("f32",e);default:throw new Error(`WebGPU operations only support 32-bit output types, got ${i}`)}}function eM(i){switch(i){case"uint32":return"0u";case"sint32":return"0";case"float32":return"0.0";default:throw new Error(`WebGPU operations only support 32-bit output types, got ${i}`)}}function jt(i){switch(i){case"uint32":return"u32";case"sint32":return"i32";case"float32":return"f32";default:throw new Error(`WebGPU operations only support 32-bit storage types, got ${i}`)}}const va=64,tM="GPGPU Operation Counts",iM="Computation Runs",nM=new Yi;function sM({module:i,elementWise:e=!1,expression:t,inputs:n,output:s,operationType:r=s.type,outputBuffer:o}){if(!i.source)throw new Error(`WebGPU computation ${i.name} requires WGSL source`);const a=uM(n),c=a.map(([v,b])=>({name:v,input:b})),l=c.filter(({input:v})=>!v.isConstant).map((v,b)=>({...v,index:b})),u=jt(r),f=jt(s.type),d={TYPE:u,RESULT_LEN:s.size.toString()},h=XA(Math.ceil(s.length/va),o.device.limits.maxComputeWorkgroupsPerDimension);for(const[v,b]of a)d[`${v.toUpperCase()}_LEN`]=b.size.toString();const g=`
${dM(i.source,d)}
${l.map(({name:v,input:b,index:x})=>rM(v,b,x)).join(`
`)}
${c.map(({name:v,input:b})=>oM(v,b,r)).join(`
`)}
${aM(s,l.length)}
${cM(s)}

@compute @workgroup_size(${va}) fn main(
  @builtin(workgroup_id) workgroupId: vec3<u32>,
  @builtin(local_invocation_id) localId: vec3<u32>
) {
  let rowIndex = ${QA(h,va)};
  if (rowIndex >= ${s.length}u) {
    return;
  }

${c.map(({name:v})=>`  let ${v} = read_${v}(rowIndex);`).join(`
`)}
  var result: array<${f}, ${s.size}>;
${lM(i.name,a,s,e,t)}
  write_result(rowIndex, result);
}
`,p=new Nl(o.device,{source:g,modules:i.dependencies,shaderAssembler:nM,shaderLayout:{bindings:[...l.map(({name:v},b)=>({name:v,type:"storage",group:0,location:b})),{name:"result",type:"storage",group:0,location:l.length}]}}),m=Object.fromEntries(l.map(({name:v,input:b})=>[v,b.buffer]));m.result=o,p.setBindings(m);const _=o.device.beginComputePass({});o.device.statsManager.getStats(tM).get(iM).incrementCount(),p.dispatch(_,h.x,h.y,h.z),_.end(),o.device.submit(),p.destroy()}function rM(i,e,t){if(e.isConstant)return"";const n=jt(e.type);return`@group(0) @binding(${t}) var<storage, read> ${i}: array<${n}>;`}function oM(i,e,t){const n=jt(t),s=e.type===t?"":n,r=e.stride/e.ValueType.BYTES_PER_ELEMENT,o=e.offset/e.ValueType.BYTES_PER_ELEMENT;return e.isConstant?`fn read_${i}(_rowIndex: u32) -> array<${n}, ${e.size}> {
  return array<${n}, ${e.size}>(${fM(e,s)});
}`:`fn read_${i}(rowIndex: u32) -> array<${n}, ${e.size}> {
  var value: array<${n}, ${e.size}>;
  let rowOffset = ${o}u + rowIndex * ${r}u;
${Array.from({length:e.size},(a,c)=>s?`  value[${c}] = ${s}(${i}[rowOffset + ${c}u]);`:`  value[${c}] = ${i}[rowOffset + ${c}u];`).join(`
`)}
  return value;
}`}function aM(i,e){const t=jt(i.type);return`@group(0) @binding(${e}) var<storage, read_write> result: array<${t}>;`}function cM(i){const e=i.stride/i.ValueType.BYTES_PER_ELEMENT,t=i.offset/i.ValueType.BYTES_PER_ELEMENT;return`fn write_result(rowIndex: u32, value: array<${jt(i.type)}, ${i.size}>) {
  let rowOffset = ${t}u + rowIndex * ${e}u;
${Array.from({length:i.size},(s,r)=>`  result[rowOffset + ${r}u] = value[${r}];`).join(`
`)}
}`}function lM(i,e,t,n,s){let r="";if(s)for(let o=0;o<t.size;o++)r+=`  result[${o}] = ${s(o)};
`;else if(n){const o=eM(t.type),a=jt(t.type);for(let c=0;c<t.size;c++){const l=e.map(([u,f])=>c<f.size?jt(f.type)===a?`${u}[${c}]`:`${a}(${u}[${c}])`:o);r+=`  result[${c}] = ${i}(${l.join(", ")});
`}}else r+=`result = ${i}(${e.map(([o])=>o).join(", ")});`;return r.trimEnd()}function uM(i){return Array.isArray(i)?i.map((e,t)=>[`x${t}`,e]):Object.entries(i)}function fM(i,e){const t=i.value;if(!t)throw new Error(`Constant input ${i} is missing CPU values`);return Array.from({length:i.size},(n,s)=>Oc(e,t[s]??0)).join(", ")}function dM(i,e){for(const t in e)i=i.replaceAll(`{${t}}`,e[t]);return i}const hM=({inputs:i,output:e,target:t})=>{const n=i.map((c,l)=>[`x${l}`,c]);gM(t.device.limits,n);const s=n.map(([c,l])=>`${c}: array<{TYPE}, ${l.size}>`).join(", ");let r=0;const o=n.map(([c,l])=>{const u=Array.from({length:l.size},(f,d)=>`  out[${r+d}] = ${c}[${d}];`).join(`
`);return r+=l.size,u}).join(`
`),a=`fn interleave(${s}) -> array<{TYPE}, {RESULT_LEN}> {
  var out: array<{TYPE}, {RESULT_LEN}>;
${o}
  return out;
}
`;return sM({module:{name:"interleave",source:a},inputs:i,output:e,outputBuffer:t}),{success:!0}};function gM(i,e){const n=e.filter(([,s])=>!s.isConstant).length+1;if(n>i.maxStorageBuffersPerShaderStage)throw new Error(`interleave() requires ${n} storage buffers, exceeding device limit ${i.maxStorageBuffersPerShaderStage}`);if(n>i.maxBindingsPerBindGroup)throw new Error(`interleave() requires ${n} bindings, exceeding bind group limit ${i.maxBindingsPerBindGroup}`)}class pM{constructor(e,{id:t,isTransitionAttribute:n}){this.packedBuffers={},this.device=e,this.id=t,this.isTransitionAttribute=n,this.device.type==="webgpu"&&Ic.add("webgpu",{interleave:hM})}hasGroups(e){return this.device.type==="webgpu"&&Object.values(e).some(t=>!!t.settings.bufferGroup)}finalize(){for(const e of Object.values(this.packedBuffers))e.packed.destroy();this.packedBuffers={}}getBufferLayouts(e,t){const n=this._getPackedGroups(e,t,{requireValues:!1,excludeAttributes:{}});return this._getBufferLayouts(e,n,t)}getBindings(e,t,n,s){const r=this._getPackedGroups(e,n,{requireValues:!0,excludeAttributes:s}),o={},a=new Set;for(const c of r.values()){const l=!this.packedBuffers[c.id]||c.attributes.some(u=>!!t[u.id]);o[c.id]=this._getPackedBuffer(c,l);for(const u of c.attributes)a.add(u.id)}return{bufferLayouts:this._getBufferLayouts(e,r,n).filter(c=>!s[c.name]&&!e[c.name]?.settings.isIndexed),buffers:o,groupedAttributeIds:a}}_getPackedGroups(e,t,{requireValues:n,excludeAttributes:s}){const r=new Map;for(const a of Object.values(e)){const c=a.settings.bufferGroup;if(!c)continue;const l=r.get(c)||[];l.push(a),r.set(c,l)}const o=new Map;for(const[a,c]of r){const l=this._getPackedGroup(a,c,t,n,s);l&&o.set(a,l)}return o}_getPackedGroup(e,t,n,s,r){if(t.length<2)return null;const o=t.map(h=>h.getBufferLayout(n)),a=o[0].stepMode,c=Math.max(1,t[0].numInstances),l=s&&t.every(h=>h.isConstant);for(let h=0;h<t.length;h++){const g=t[h],p=g.getAccessor(),m=p.size*p.bytesPerElement;if(r[g.id]||g.settings.isIndexed||g.settings.noAlloc||g.doublePrecision||this.isTransitionAttribute(g.id)||o[h].stepMode!==a||g.numInstances!==t[0].numInstances||(p.offset||0)!==0||(p.vertexOffset||0)!==0||ft(p)!==m||s&&(g.isConstant?!g.getConstantValue()||g.getConstantValue().byteLength<m:!ArrayBuffer.isView(g.value)||g.value.byteLength<c*m))return null}const u={},f=[];let d=0;for(let h=0;h<t.length;h++){const g=t[h];d=Wd(d),u[g.id]=d;for(const p of o[h].attributes||[])f.push({...p,byteOffset:d+(p.byteOffset||0)});d+=ft(g.getAccessor())}return d=Wd(d),{id:e,attributes:t,byteStride:d,byteOffsets:u,rowCount:c,layout:{name:e,byteStride:l?0:d,stepMode:a,attributes:f}}}_getBufferLayouts(e,t,n){const s=[],r=new Set,o=new Set;for(const a of t.values())for(const c of a.attributes)o.add(c.id);for(const a of Object.values(e)){const c=a.settings.bufferGroup,l=c&&t.get(c);l&&o.has(a.id)?r.has(l.id)||(s.push(l.layout),r.add(l.id)):s.push(a.getBufferLayout(n))}return s}_getPackedBuffer(e,t){const n=JSON.stringify({byteStride:e.layout.byteStride,attributes:e.layout.attributes}),s=this.packedBuffers[e.id];if((!s||s.layoutKey!==n)&&(t=!0),t){s&&(s.packed.destroy(),delete this.packedBuffers[e.id]);const r=this._interleavePackedGroup(e);return this.packedBuffers[e.id]={packed:r,layoutKey:n},r.buffer}if(!s)throw new Error(`Attribute buffer group ${e.id} has no packed buffer`);return s.packed.buffer}_interleavePackedGroup(e){const t=e.attributes.map(s=>this._getInterleaveInput(e,s)),n=GA(...t);return VA(this.device,n),n}_getInterleaveInput(e,t){const n=ft(t.getAccessor()),s=e.byteOffsets[t.id];if(_n(`${e.id}.${t.id} rowByteLength`,n),_n(`${e.id}.${t.id} groupByteOffset`,s),t.isConstant){const c=t.getConstantValue();if(!c)throw new Error(`Attribute group ${e.id} is missing constant value ${t.id}`);return _n(`${e.id}.${t.id} constant byteOffset`,c.byteOffset),new ge({id:t.id,type:"uint32",size:n/4,isConstant:!0,value:new Uint32Array(c.buffer,c.byteOffset,n/Uint32Array.BYTES_PER_ELEMENT)})}const r=t.getBuffer(),o=t.byteOffset,a=t.getAccessor().stride||n;if(_n(`${e.id}.${t.id} byteOffset`,o),_n(`${e.id}.${t.id} stride`,a),!r)throw new Error(`Attribute group ${e.id} cannot interleave missing buffer ${t.id}`);return new ge({id:t.id,type:"uint32",size:n/4,offset:o,stride:a,length:e.rowCount,buffer:r})}}function Wd(i){return Math.ceil(i/4)*4}function _n(i,e){if(e%4!==0)throw new Error(`Attribute buffer groups require 32-bit alignment: ${i}=${e}`)}function xa(i){const{source:e,target:t,start:n=0,size:s,getData:r}=i,o=i.end||t.length,a=e.length,c=o-n;if(a>c){t.set(e.subarray(0,c),n);return}if(t.set(e,n),!r)return;let l=a;for(;l<c;){const u=r(l,e);for(let f=0;f<s;f++)t[n+l]=u[f]||0,l++}}function mM({source:i,target:e,size:t,getData:n,sourceStartIndices:s,targetStartIndices:r}){if(!s||!r)return xa({source:i,target:e,size:t,getData:n}),e;let o=0,a=0;const c=n&&((u,f)=>n(u+a,f)),l=Math.min(s.length,r.length);for(let u=1;u<l;u++){const f=s[u]*t,d=r[u]*t;xa({source:i.subarray(o,f),target:e,start:a,end:d,size:t,getData:c}),o=f,a=d}return a<e.length&&xa({source:[],target:e,start:a,size:t,getData:c}),e}function yM(i){const{device:e,settings:t,value:n}=i,s=new Tm(e,t);return s.setData({value:n instanceof Float64Array?new Float64Array(0):new Float32Array(0),normalized:t.normalized}),s}function Dm(i){switch(i){case 1:return"float";case 2:return"vec2";case 3:return"vec3";case 4:return"vec4";default:throw new Error(`No defined attribute type for size "${i}"`)}}function Fm(i){switch(i){case 1:return"float32";case 2:return"float32x2";case 3:return"float32x3";case 4:return"float32x4";default:throw new Error("invalid type size")}}function zm(i){i.push(i.shift())}function _M(i,e){const{settings:t,value:n,size:s}=i,r=i.isDoublePrecisionBuffer?2:1;let o=0;const{shaderAttributes:a}=i.settings;if(a)for(const c of Object.values(a))o=Math.max(o,c.vertexOffset??0);return(t.noAlloc?n.length:(e+o)*s)*r}function Nm({device:i,source:e,target:t}){return(!t||t.byteLength<e.byteLength)&&(t?.destroy(),t=i.createBuffer({byteLength:e.byteLength,usage:e.usage})),t}function Um({device:i,buffer:e,attribute:t,fromLength:n,toLength:s,fromStartIndices:r,getData:o=a=>a}){const a=t.isDoublePrecisionBuffer?2:1,c=t.size*a,l=t.byteOffset,u=t.settings.bytesPerElement<4?l/t.settings.bytesPerElement*4:l,f=t.startIndices,d=r&&f,h=t.isConstant;if(!d&&e&&n>=s)return e;const g=t.value instanceof Float64Array?Float32Array:t.value.constructor,p=h?t.value:new g(t.getBuffer().readSyncWebGL(l,s*g.BYTES_PER_ELEMENT).buffer);if(t.settings.normalized&&!h){const b=o;o=(x,w)=>t.normalizeConstant(b(x,w))}const m=h?(b,x)=>o(p,x):(b,x)=>o(p.subarray(b+l,b+l+c),x),_=e?new Float32Array(e.readSyncWebGL(u,n*4).buffer):new Float32Array(0),v=new Float32Array(s);return mM({source:_,target:v,sourceStartIndices:r,targetStartIndices:f,size:c,getData:m}),(!e||e.byteLength<v.byteLength+u)&&(e?.destroy(),e=i.createBuffer({byteLength:v.byteLength+u,usage:35050})),e.write(v,u),e}class $m{constructor({device:e,attribute:t,timeline:n}){this.buffers=[],this.currentLength=0,this.device=e,this.transition=new no(n),this.attribute=t,this.attributeInTransition=yM(t),this.currentStartIndices=t.startIndices}get inProgress(){return this.transition.inProgress}start(e,t,n=1/0){this.settings=e,this.currentStartIndices=this.attribute.startIndices,this.currentLength=_M(this.attribute,t),this.transition.start({...e,duration:n})}update(){const e=this.transition.update();return e&&this.onUpdate(),e}setBuffer(e){const{stride:t}=this.attributeInTransition.getAccessor();this.attributeInTransition.setData({buffer:e,normalized:this.attribute.settings.normalized,value:this.attributeInTransition.value,stride:t})}cancel(){this.transition.cancel()}delete(){this.cancel();for(const e of this.buffers)e.destroy();this.buffers.length=0}}class bM extends $m{constructor({device:e,attribute:t,timeline:n}){super({device:e,attribute:t,timeline:n}),this.type="interpolation",this.transform=PM(e,t)}start(e,t){const n=this.currentLength,s=this.currentStartIndices;if(super.start(e,t,e.duration),e.duration<=0){this.transition.cancel();return}const{buffers:r,attribute:o}=this;zm(r),r[0]=Um({device:this.device,buffer:r[0],attribute:o,fromLength:n,toLength:this.currentLength,fromStartIndices:s,getData:e.enter}),r[1]=Nm({device:this.device,source:r[0],target:r[1]}),this.setBuffer(r[1]);const{transform:a}=this,c=a.model;let l=Math.floor(this.currentLength/o.size);Gm(o)&&(l/=2),c.setVertexCount(l),o.isConstant?(c.setAttributes({aFrom:r[0]}),c.setConstantAttributes({aTo:o.value})):c.setAttributes({aFrom:r[0],aTo:o.getBuffer()}),a.transformFeedback.setBuffers({vCurrent:r[1]})}onUpdate(){const{duration:e,easing:t}=this.settings,{time:n}=this.transition;let s=n/e;t&&(s=t(s));const{model:r}=this.transform,o={time:s};r.shaderInputs.setProps({interpolation:o}),this.transform.run({discard:!0})}delete(){super.delete(),this.transform.destroy()}}const vM=`layout(std140) uniform interpolationUniforms {
  float time;
} interpolation;
`,Hd={name:"interpolation",vs:vM,uniformTypes:{time:"f32"}},xM=`#version 300 es
#define SHADER_NAME interpolation-transition-vertex-shader

in ATTRIBUTE_TYPE aFrom;
in ATTRIBUTE_TYPE aTo;
out ATTRIBUTE_TYPE vCurrent;

void main(void) {
  vCurrent = mix(aFrom, aTo, interpolation.time);
  gl_Position = vec4(0.0);
}
`,wM=`#version 300 es
#define SHADER_NAME interpolation-transition-vertex-shader

in ATTRIBUTE_TYPE aFrom;
in ATTRIBUTE_TYPE aFrom64Low;
in ATTRIBUTE_TYPE aTo;
in ATTRIBUTE_TYPE aTo64Low;
out ATTRIBUTE_TYPE vCurrent;
out ATTRIBUTE_TYPE vCurrent64Low;

vec2 mix_fp64(vec2 a, vec2 b, float x) {
  vec2 range = sub_fp64(b, a);
  return sum_fp64(a, mul_fp64(range, vec2(x, 0.0)));
}

void main(void) {
  for (int i=0; i<ATTRIBUTE_SIZE; i++) {
    vec2 value = mix_fp64(vec2(aFrom[i], aFrom64Low[i]), vec2(aTo[i], aTo64Low[i]), interpolation.time);
    vCurrent[i] = value.x;
    vCurrent64Low[i] = value.y;
  }
  gl_Position = vec4(0.0);
}
`;function Gm(i){return i.isDoublePrecisionBuffer}function PM(i,e){const t=e.size,n=Dm(t),s=Fm(t),r=e.getBufferLayout();return Gm(e)?new Ki(i,{vs:wM,bufferLayout:[{name:"aFrom",byteStride:8*t,attributes:[{attribute:"aFrom",format:s,byteOffset:0},{attribute:"aFrom64Low",format:s,byteOffset:4*t}]},{name:"aTo",byteStride:8*t,attributes:[{attribute:"aTo",format:s,byteOffset:0},{attribute:"aTo64Low",format:s,byteOffset:4*t}]}],modules:[Q2,Hd],defines:{ATTRIBUTE_TYPE:n,ATTRIBUTE_SIZE:t},moduleSettings:{},varyings:["vCurrent","vCurrent64Low"],bufferMode:35980,disableWarnings:!0}):new Ki(i,{vs:xM,bufferLayout:[{name:"aFrom",format:s},{name:"aTo",format:r.attributes[0].format}],modules:[Hd],defines:{ATTRIBUTE_TYPE:n},varyings:["vCurrent"],disableWarnings:!0})}class SM extends $m{constructor({device:e,attribute:t,timeline:n}){super({device:e,attribute:t,timeline:n}),this.type="spring",this.texture=MM(e),this.framebuffer=IM(e,this.texture),this.transform=AM(e,t)}start(e,t){const n=this.currentLength,s=this.currentStartIndices;super.start(e,t);const{buffers:r,attribute:o}=this;for(let c=0;c<2;c++)r[c]=Um({device:this.device,buffer:r[c],attribute:o,fromLength:n,toLength:this.currentLength,fromStartIndices:s,getData:e.enter});r[2]=Nm({device:this.device,source:r[0],target:r[2]}),this.setBuffer(r[1]);const{model:a}=this.transform;a.setVertexCount(Math.floor(this.currentLength/o.size)),o.isConstant?a.setConstantAttributes({aTo:o.value}):a.setAttributes({aTo:o.getBuffer()})}onUpdate(){const{buffers:e,transform:t,framebuffer:n,transition:s}=this,r=this.settings;t.model.setAttributes({aPrev:e[0],aCur:e[1]}),t.transformFeedback.setBuffers({vNext:e[2]});const o={stiffness:r.stiffness,damping:r.damping};t.model.shaderInputs.setProps({spring:o}),t.run({framebuffer:n,discard:!1,parameters:{viewport:[0,0,1,1]},clearColor:[0,0,0,0]}),zm(e),this.setBuffer(e[1]),this.device.readPixelsToArrayWebGL(n)[0]>0||s.end()}delete(){super.delete(),this.transform.destroy(),this.texture.destroy(),this.framebuffer.destroy()}}const EM=`layout(std140) uniform springUniforms {
  float damping;
  float stiffness;
} spring;
`,CM={name:"spring",vs:EM,uniformTypes:{damping:"f32",stiffness:"f32"}},LM=`#version 300 es
#define SHADER_NAME spring-transition-vertex-shader

#define EPSILON 0.00001

in ATTRIBUTE_TYPE aPrev;
in ATTRIBUTE_TYPE aCur;
in ATTRIBUTE_TYPE aTo;
out ATTRIBUTE_TYPE vNext;
out float vIsTransitioningFlag;

ATTRIBUTE_TYPE getNextValue(ATTRIBUTE_TYPE cur, ATTRIBUTE_TYPE prev, ATTRIBUTE_TYPE dest) {
  ATTRIBUTE_TYPE velocity = cur - prev;
  ATTRIBUTE_TYPE delta = dest - cur;
  ATTRIBUTE_TYPE force = delta * spring.stiffness;
  ATTRIBUTE_TYPE resistance = velocity * spring.damping;
  return force - resistance + velocity + cur;
}

void main(void) {
  bool isTransitioning = length(aCur - aPrev) > EPSILON || length(aTo - aCur) > EPSILON;
  vIsTransitioningFlag = isTransitioning ? 1.0 : 0.0;

  vNext = getNextValue(aCur, aPrev, aTo);
  gl_Position = vec4(0, 0, 0, 1);
  gl_PointSize = 100.0;
}
`,TM=`#version 300 es
#define SHADER_NAME spring-transition-is-transitioning-fragment-shader

in float vIsTransitioningFlag;

out vec4 fragColor;

void main(void) {
  if (vIsTransitioningFlag == 0.0) {
    discard;
  }
  fragColor = vec4(1.0);
}`;function AM(i,e){const t=Dm(e.size),n=Fm(e.size);return new Ki(i,{vs:LM,fs:TM,bufferLayout:[{name:"aPrev",format:n},{name:"aCur",format:n},{name:"aTo",format:e.getBufferLayout().attributes[0].format}],varyings:["vNext"],modules:[CM],defines:{ATTRIBUTE_TYPE:t},parameters:{depthCompare:"always",blendColorOperation:"max",blendColorSrcFactor:"one",blendColorDstFactor:"one",blendAlphaOperation:"max",blendAlphaSrcFactor:"one",blendAlphaDstFactor:"one"}})}function MM(i){return i.createTexture({data:new Uint8Array(4),format:"rgba8unorm",width:1,height:1})}function IM(i,e){return i.createFramebuffer({id:"spring-transition-is-transitioning-framebuffer",width:1,height:1,colorAttachments:[e]})}const RM={interpolation:bM,spring:SM};class OM{constructor(e,{id:t,timeline:n}){if(!e)throw new Error("AttributeTransitionManager is constructed without device");this.id=t,this.device=e,this.timeline=n,this.transitions={},this.needsRedraw=!1,this.numInstances=1}finalize(){for(const e in this.transitions)this._removeTransition(e)}update({attributes:e,transitions:t,numInstances:n}){this.numInstances=n||1;for(const s in e){const r=e[s],o=r.getTransitionSetting(t);o&&this._updateAttribute(s,r,o)}for(const s in this.transitions){const r=e[s];(!r||!r.getTransitionSetting(t))&&this._removeTransition(s)}}hasAttribute(e){const t=this.transitions[e];return t&&t.inProgress}getAttributes(){const e={};for(const t in this.transitions){const n=this.transitions[t];n.inProgress&&(e[t]=n.attributeInTransition)}return e}run(){if(this.numInstances===0)return!1;for(const t in this.transitions)this.transitions[t].update()&&(this.needsRedraw=!0);const e=this.needsRedraw;return this.needsRedraw=!1,e}_removeTransition(e){this.transitions[e].delete(),delete this.transitions[e]}_updateAttribute(e,t,n){const s=this.transitions[e];let r=!s||s.type!==n.type;if(r){s&&this._removeTransition(e);const o=RM[n.type];o?this.transitions[e]=new o({attribute:t,timeline:this.timeline,device:this.device}):(K.error(`unsupported transition type '${n.type}'`)(),r=!1)}(r||t.needsRedraw())&&(this.needsRedraw=!0,this.transitions[e].start(n,this.numInstances))}}const Yd="attributeManager.invalidate",kM="attributeManager.updateStart",BM="attributeManager.updateEnd",DM="attribute.updateStart",FM="attribute.allocate",zM="attribute.updateEnd";class NM{constructor(e,{id:t="attribute-manager",stats:n,timeline:s}={}){this.mergeBoundsMemoized=ss(sC),this.id=t,this.device=e,this.attributes={},this.updateTriggers={},this.needsRedraw=!0,this.userData={},this.stats=n,this.attributeTransitionManager=new OM(e,{id:`${t}-transitions`,timeline:s}),this.attributeBufferGroups=e.type==="webgpu"?new pM(e,{id:t,isTransitionAttribute:r=>this.attributeTransitionManager.hasAttribute(r)}):null,Object.seal(this)}finalize(){this.attributeBufferGroups?.finalize();for(const e in this.attributes)this.attributes[e].delete();this.attributeTransitionManager.finalize()}getNeedsRedraw(e={clearRedrawFlags:!1}){const t=this.needsRedraw;return this.needsRedraw=this.needsRedraw&&!e.clearRedrawFlags,t&&this.id}setNeedsRedraw(){this.needsRedraw=!0}add(e){this._add(e)}addInstanced(e){this._add(e,{stepMode:"instance"})}remove(e){for(const t of e)this.attributes[t]!==void 0&&(this.attributes[t].delete(),delete this.attributes[t])}invalidate(e,t){const n=this._invalidateTrigger(e,t);Se(Yd,this,e,n)}invalidateAll(e){for(const t in this.attributes)this.attributes[t].setNeedsUpdate(t,e);Se(Yd,this,"all")}update({data:e,numInstances:t,startIndices:n=null,transitions:s,props:r={},buffers:o={},context:a={}}){let c=!1;Se(kM,this),this.stats&&this.stats.get("Update Attributes").timeStart();for(const l in this.attributes){const u=this.attributes[l],f=u.settings.accessor;u.startIndices=n,u.numInstances=t,r[l]&&K.removed(`props.${l}`,`data.attributes.${l}`)(),u.setExternalBuffer(o[l])||u.setBinaryValue(typeof f=="string"?o[f]:void 0,e.startIndices)||typeof f=="string"&&!o[f]&&u.setConstantValue(a,r[f])||u.needsUpdate()&&(c=!0,this._updateAttribute({attribute:u,numInstances:t,data:e,props:r,context:a})),this.needsRedraw=this.needsRedraw||u.needsRedraw()}c&&Se(BM,this,t),this.stats&&(this.stats.get("Update Attributes").timeEnd(),c&&this.stats.get("Attributes updated").incrementCount()),this.attributeTransitionManager.update({attributes:this.attributes,numInstances:t,transitions:s})}updateTransition(){const{attributeTransitionManager:e}=this,t=e.run();return this.needsRedraw=this.needsRedraw||t,t}getAttributes(){return{...this.attributes,...this.attributeTransitionManager.getAttributes()}}getBounds(e){const t=e.map(n=>this.attributes[n]?.getBounds());return this.mergeBoundsMemoized(t)}getChangedAttributes(e={clearChangedFlags:!1}){const{attributes:t,attributeTransitionManager:n}=this,s={...n.getAttributes()};for(const r in t){const o=t[r];o.needsRedraw(e)&&!n.hasAttribute(r)&&(s[r]=o)}return s}getBufferLayouts(e){return this.hasBufferGroups()?this.attributeBufferGroups.getBufferLayouts(this.getAttributes(),e):Object.values(this.getAttributes()).map(t=>t.getBufferLayout(e))}hasBufferGroups(){return!!this.attributeBufferGroups?.hasGroups(this.attributes)}getBufferGroupBindings(e,t,n={}){return this.attributeBufferGroups?this.attributeBufferGroups.getBindings(this.getAttributes(),e,t,n):{bufferLayouts:this.getBufferLayouts(t),buffers:{},groupedAttributeIds:new Set}}_add(e,t){for(const n in e){const s=e[n],r={...s,id:n,size:s.isIndexed&&1||s.size||1,...t};this.attributes[n]=new Tm(this.device,r)}this._mapUpdateTriggersToAttributes()}_mapUpdateTriggersToAttributes(){const e={};for(const t in this.attributes)this.attributes[t].getUpdateTriggers().forEach(s=>{e[s]||(e[s]=[]),e[s].push(t)});this.updateTriggers=e}_invalidateTrigger(e,t){const{attributes:n,updateTriggers:s}=this,r=s[e];return r&&r.forEach(o=>{const a=n[o];a&&a.setNeedsUpdate(a.id,t)}),r}_updateAttribute(e){const{attribute:t,numInstances:n}=e;if(Se(DM,t),t.constant){t.setConstantValue(e.context,t.value);return}t.allocate(n)&&Se(FM,t,n),t.updateBuffer(e)&&(this.needsRedraw=!0,Se(zM,t,n))}}class UM extends no{get value(){return this._value}_onUpdate(){const{time:e,settings:{fromValue:t,toValue:n,duration:s,easing:r}}=this,o=r(e/s);this._value=Ut(t,n,o)}}const qd=1e-5;function Zd(i,e,t,n,s){const r=e-i,a=(t-e)*s,c=-r*n;return a+c+r+e}function $M(i,e,t,n,s){if(Array.isArray(t)){const r=[];for(let o=0;o<t.length;o++)r[o]=Zd(i[o],e[o],t[o],n,s);return r}return Zd(i,e,t,n,s)}function Xd(i,e){if(Array.isArray(i)){let t=0;for(let n=0;n<i.length;n++){const s=i[n]-e[n];t+=s*s}return Math.sqrt(t)}return Math.abs(i-e)}class GM extends no{get value(){return this._currValue}_onUpdate(){const{fromValue:e,toValue:t,damping:n,stiffness:s}=this.settings,{_prevValue:r=e,_currValue:o=e}=this;let a=$M(r,o,t,n,s);const c=Xd(a,t),l=Xd(a,o);c<qd&&l<qd&&(a=t,this.end()),this._prevValue=o,this._currValue=a}}const VM={interpolation:UM,spring:GM};class jM{constructor(e){this.transitions=new Map,this.timeline=e}get active(){return this.transitions.size>0}add(e,t,n,s){const{transitions:r}=this;if(r.has(e)){const c=r.get(e),{value:l=c.settings.fromValue}=c;t=l,this.remove(e)}if(s=Lm(s),!s)return;const o=VM[s.type];if(!o){K.error(`unsupported transition type '${s.type}'`)();return}const a=new o(this.timeline);a.start({...s,fromValue:t,toValue:n}),r.set(e,a)}remove(e){const{transitions:t}=this;t.has(e)&&(t.get(e).cancel(),t.delete(e))}update(){const e={};for(const[t,n]of this.transitions)n.update(),e[t]=n.value,n.inProgress||this.remove(t);return e}clear(){for(const e of this.transitions.keys())this.remove(e)}}function WM(i){const e=i[$t];for(const t in e){const n=e[t],{validate:s}=n;if(s&&!s(i[t],n))throw new Error(`Invalid prop ${t}: ${i[t]}`)}}function HM(i,e){const t=Vm({newProps:i,oldProps:e,propTypes:i[$t],ignoreProps:{data:null,updateTriggers:null,extensions:null,transitions:null}}),n=qM(i,e);let s=!1;return n||(s=ZM(i,e)),{dataChanged:n,propsChanged:t,updateTriggersChanged:s,extensionsChanged:XM(i,e),transitionsChanged:YM(i,e)}}function YM(i,e){if(!i.transitions)return!1;const t={},n=i[$t];let s=!1;for(const r in i.transitions){const o=n[r],a=o&&o.type;(a==="number"||a==="color"||a==="array")&&kc(i[r],e[r],o)&&(t[r]=!0,s=!0)}return s?t:!1}function Vm({newProps:i,oldProps:e,ignoreProps:t={},propTypes:n={},triggerName:s="props"}){if(e===i)return!1;if(typeof i!="object"||i===null)return`${s} changed shallowly`;if(typeof e!="object"||e===null)return`${s} changed shallowly`;for(const r of Object.keys(i))if(!(r in t)){if(!(r in e))return`${s}.${r} added`;const o=kc(i[r],e[r],n[r]);if(o)return`${s}.${r} ${o}`}for(const r of Object.keys(e))if(!(r in t)){if(!(r in i))return`${s}.${r} dropped`;if(!Object.hasOwnProperty.call(i,r)){const o=kc(i[r],e[r],n[r]);if(o)return`${s}.${r} ${o}`}}return!1}function kc(i,e,t){let n=t&&t.equal;return n&&!n(i,e,t)||!n&&(n=i&&e&&i.equals,n&&!n.call(i,e))?"changed deeply":!n&&e!==i?"changed shallowly":null}function qM(i,e){if(e===null)return"oldProps is null, initial diff";let t=!1;const{dataComparator:n,_dataDiff:s}=i;return n?n(i.data,e.data)||(t="Data comparator detected a change"):i.data!==e.data&&(t="A new data container was supplied"),t&&s&&(t=s(i.data,e.data)||t),t}function ZM(i,e){if(e===null)return{all:!0};if("all"in i.updateTriggers&&Kd(i,e,"all"))return{all:!0};const t={};let n=!1;for(const s in i.updateTriggers)s!=="all"&&Kd(i,e,s)&&(t[s]=!0,n=!0);return n?t:!1}function XM(i,e){if(e===null)return!0;const t=e.extensions,{extensions:n}=i;if(n===t)return!1;if(!t||!n||n.length!==t.length)return!0;for(let s=0;s<n.length;s++)if(!n[s].equals(t[s]))return!0;return!1}function Kd(i,e,t){let n=i.updateTriggers[t];n=n??{};let s=e.updateTriggers[t];return s=s??{},Vm({oldProps:s,newProps:n,triggerName:t})}const KM="count(): argument not an object",QM="count(): argument not a container";function JM(i){if(!tI(i))throw new Error(KM);if(typeof i.count=="function")return i.count();if(Number.isFinite(i.size))return i.size;if(Number.isFinite(i.length))return i.length;if(eI(i))return Object.keys(i).length;throw new Error(QM)}function eI(i){return i!==null&&typeof i=="object"&&i.constructor===Object}function tI(i){return i!==null&&typeof i=="object"}function Qd(i,e){if(!e)return i;const t={...i,...e};if("defines"in e&&(t.defines={...i.defines,...e.defines}),"modules"in e&&(t.modules=(i.modules||[]).concat(e.modules),e.modules.some(n=>n.name==="project64"))){const n=t.modules.findIndex(s=>s.name==="project32");n>=0&&t.modules.splice(n,1)}if("inject"in e)if(!i.inject)t.inject=e.inject;else{const n={...i.inject};for(const s in e.inject)n[s]=(n[s]||"")+e.inject[s];t.inject=n}return t}const iI={minFilter:"linear",mipmapFilter:"linear",magFilter:"linear",addressModeU:"clamp-to-edge",addressModeV:"clamp-to-edge"},Bc={};function nI(i,e,t,n){if(t instanceof re)return t;t.constructor&&t.constructor.name!=="Object"&&(t={data:t});let s=null;t.compressed&&(s={minFilter:"linear",mipmapFilter:t.data.length>1?"nearest":"linear"});const{width:r,height:o}=t.data,a=e.createTexture({...t,sampler:{...iI,...s,...n},mipLevels:e.getMipLevelCount(r,o)});return e.type==="webgl"?a.generateMipmapsWebGL():e.type==="webgpu"&&e.generateMipmapsWebGPU(a),Bc[a.id]=i,a}function sI(i,e){!e||!(e instanceof re)||Bc[e.id]===i&&(e.delete(),delete Bc[e.id])}const rI={boolean:{validate(i,e){return!0},equal(i,e,t){return!!i==!!e}},number:{validate(i,e){return Number.isFinite(i)&&(!("max"in e)||i<=e.max)&&(!("min"in e)||i>=e.min)}},color:{validate(i,e){return e.optional&&!i||Dc(i)&&(i.length===3||i.length===4)},equal(i,e,t){return Me(i,e,1)}},accessor:{validate(i,e){const t=kr(i);return t==="function"||t===kr(e.value)},equal(i,e,t){return typeof e=="function"?!0:Me(i,e,1)}},array:{validate(i,e){return e.optional&&!i||Dc(i)},equal(i,e,t){const{compare:n}=t,s=Number.isInteger(n)?n:n?1:0;return n?Me(i,e,s):i===e}},object:{equal(i,e,t){if(t.ignore)return!0;const{compare:n}=t,s=Number.isInteger(n)?n:n?1:0;return n?Me(i,e,s):i===e}},function:{validate(i,e){return e.optional&&!i||typeof i=="function"},equal(i,e,t){return!t.compare&&t.ignore!==!1||i===e}},data:{transform:(i,e,t)=>{if(!i)return i;const{dataTransform:n}=t.props;return n?n(i):typeof i.shape=="string"&&i.shape.endsWith("-table")&&Array.isArray(i.data)?i.data:i}},image:{transform:(i,e,t)=>{const n=t.context;return!n||!n.device?null:nI(t.id,n.device,i,{...e.parameters,...t.props.textureParameters})},release:(i,e,t)=>{sI(t.id,i)}}};function oI(i){const e={},t={},n={};for(const[s,r]of Object.entries(i)){const o=r?.deprecatedFor;if(o)n[s]=Array.isArray(o)?o:[o];else{const a=aI(s,r);e[s]=a,t[s]=a.value}}return{propTypes:e,defaultProps:t,deprecatedProps:n}}function aI(i,e){switch(kr(e)){case"object":return bn(i,e);case"array":return bn(i,{type:"array",value:e,compare:!1});case"boolean":return bn(i,{type:"boolean",value:e});case"number":return bn(i,{type:"number",value:e});case"function":return bn(i,{type:"function",value:e,compare:!0});default:return{name:i,type:"unknown",value:e}}}function bn(i,e){return"type"in e?{name:i,...rI[e.type],...e}:"value"in e?{name:i,type:kr(e.value),...e}:{name:i,type:"object",value:e}}function Dc(i){return Array.isArray(i)||ArrayBuffer.isView(i)}function kr(i){return Dc(i)?"array":i===null?"null":typeof i}function cI(i,e){let t;for(let r=e.length-1;r>=0;r--){const o=e[r];"extensions"in o&&(t=o.extensions)}const n=Fc(i.constructor,t),s=Object.create(n);s[Ir]=i,s[fi]={},s[Dt]={};for(let r=0;r<e.length;++r){const o=e[r];for(const a in o)s[a]=o[a]}return Object.freeze(s),s}const lI="_mergedDefaultProps";function Fc(i,e){if(!(i instanceof ro.constructor))return{};let t=lI;if(e)for(const s of e){const r=s.constructor;r&&(t+=`:${r.extensionName||r.name}`)}const n=jm(i,t);return n||(i[t]=uI(i,e||[]))}function uI(i,e){if(!i.prototype)return null;const n=Object.getPrototypeOf(i),s=Fc(n),r=jm(i,"defaultProps")||{},o=oI(r),a=Object.assign(Object.create(null),s,o.defaultProps),c=Object.assign(Object.create(null),s?.[$t],o.propTypes),l=Object.assign(Object.create(null),s?.[ra],o.deprecatedProps);for(const u of e){const f=Fc(u.constructor);f&&(Object.assign(a,f),Object.assign(c,f[$t]),Object.assign(l,f[ra]))}return fI(a,i),hI(a,c),dI(a,l),a[$t]=c,a[ra]=l,e.length===0&&!Kl(i,"_propTypes")&&(i._propTypes=c),a}function fI(i,e){const t=pI(e);Object.defineProperties(i,{id:{writable:!0,value:t}})}function dI(i,e){for(const t in e)Object.defineProperty(i,t,{enumerable:!1,set(n){const s=`${this.id}: ${t}`;for(const r of e[t])Kl(this,r)||(this[r]=n);K.deprecated(s,e[t].join("/"))()}})}function hI(i,e){const t={},n={};for(const s in e){const r=e[s],{name:o,value:a}=r;r.async&&(t[o]=a,n[o]=gI(o))}i[$i]=t,i[fi]={},Object.defineProperties(i,n)}function gI(i){return{enumerable:!0,set(e){typeof e=="string"||e instanceof Promise||Em(e)?this[fi][i]=e:this[Dt][i]=e},get(){if(this[Dt]){if(i in this[Dt])return this[Dt][i]||this[$i][i];if(i in this[fi]){const e=this[Ir]&&this[Ir].internalState;if(e&&e.hasAsyncProp(i))return e.getAsyncProp(i)||this[$i][i]}}return this[$i][i]}}}function Kl(i,e){return Object.prototype.hasOwnProperty.call(i,e)}function jm(i,e){return Kl(i,e)&&i[e]}function pI(i){const e=i.componentName;return e||K.warn(`${i.name}.componentName not specified`)(),e||i.name}let mI=0;class ro{constructor(...e){this.props=cI(this,e),this.id=this.props.id,this.count=mI++}clone(e){const{props:t}=this,n={};for(const s in t[$i])s in t[Dt]?n[s]=t[Dt][s]:s in t[fi]&&(n[s]=t[fi][s]);return new this.constructor({...t,...n,...e})}}ro.componentName="Component";ro.defaultProps={};const yI=Object.freeze({});class _I{constructor(e){this.component=e,this.asyncProps={},this.onAsyncPropUpdated=()=>{},this.oldProps=null,this.oldAsyncProps=null}finalize(){for(const e in this.asyncProps){const t=this.asyncProps[e];t&&t.type&&t.type.release&&t.type.release(t.resolvedValue,t.type,this.component)}this.asyncProps={},this.component=null,this.resetOldProps()}getOldProps(){return this.oldAsyncProps||this.oldProps||yI}resetOldProps(){this.oldAsyncProps=null,this.oldProps=this.component?this.component.props:null}hasAsyncProp(e){return e in this.asyncProps}getAsyncProp(e){const t=this.asyncProps[e];return t&&t.resolvedValue}isAsyncPropLoading(e){if(e){const t=this.asyncProps[e];return!!(t&&t.pendingLoadCount>0&&t.pendingLoadCount!==t.resolvedLoadCount)}for(const t in this.asyncProps)if(this.isAsyncPropLoading(t))return!0;return!1}reloadAsyncProp(e,t){this._watchPromise(e,Promise.resolve(t))}setAsyncProps(e){this.component=e[Ir]||this.component;const t=e[Dt]||{},n=e[fi]||e,s=e[$i]||{};for(const r in t){const o=t[r];this._createAsyncPropData(r,s[r]),this._updateAsyncProp(r,o),t[r]=this.getAsyncProp(r)}for(const r in n){const o=n[r];this._createAsyncPropData(r,s[r]),this._updateAsyncProp(r,o)}}_fetch(e,t){return null}_onResolve(e,t){}_onError(e,t){}_updateAsyncProp(e,t){if(this._didAsyncInputValueChange(e,t)){if(typeof t=="string"&&(t=this._fetch(e,t)),t instanceof Promise){this._watchPromise(e,t);return}if(Em(t)){this._resolveAsyncIterable(e,t);return}this._setPropValue(e,t)}}_freezeAsyncOldProps(){if(!this.oldAsyncProps&&this.oldProps){this.oldAsyncProps=Object.create(this.oldProps);for(const e in this.asyncProps)Object.defineProperty(this.oldAsyncProps,e,{enumerable:!0,value:this.oldProps[e]})}}_didAsyncInputValueChange(e,t){const n=this.asyncProps[e];return t===n.resolvedValue||t===n.lastValue?!1:(n.lastValue=t,!0)}_setPropValue(e,t){this._freezeAsyncOldProps();const n=this.asyncProps[e];n&&(t=this._postProcessValue(n,t),n.resolvedValue=t,n.pendingLoadCount++,n.resolvedLoadCount=n.pendingLoadCount)}_setAsyncPropValue(e,t,n){const s=this.asyncProps[e];s&&n>=s.resolvedLoadCount&&t!==void 0&&(this._freezeAsyncOldProps(),s.resolvedValue=t,s.resolvedLoadCount=n,this.onAsyncPropUpdated(e,t))}_watchPromise(e,t){const n=this.asyncProps[e];if(n){n.pendingLoadCount++;const s=n.pendingLoadCount;t.then(r=>{this.component&&(r=this._postProcessValue(n,r),this._setAsyncPropValue(e,r,s),this._onResolve(e,r))}).catch(r=>{this._onError(e,r)})}}async _resolveAsyncIterable(e,t){if(e!=="data"){this._setPropValue(e,t);return}const n=this.asyncProps[e];if(!n)return;n.pendingLoadCount++;const s=n.pendingLoadCount;let r=[],o=0;for await(const a of t){if(!this.component)return;const{dataTransform:c}=this.component.props;c?r=c(a,r):r=r.concat(a),Object.defineProperty(r,"__diff",{enumerable:!1,value:[{startRow:o,endRow:r.length}]}),o=r.length,this._setAsyncPropValue(e,r,s)}this._onResolve(e,r)}_postProcessValue(e,t){const n=e.type;return n&&this.component&&(n.release&&n.release(e.resolvedValue,n,this.component),n.transform)?n.transform(t,n,this.component):t}_createAsyncPropData(e,t){if(!this.asyncProps[e]){const s=this.component&&this.component.props[$t];this.asyncProps[e]={type:s&&s[e],lastValue:null,resolvedValue:t,pendingLoadCount:0,resolvedLoadCount:0}}}}class bI extends _I{constructor({attributeManager:e,layer:t}){super(t),this.attributeManager=e,this.needsRedraw=!0,this.needsUpdate=!0,this.subLayers=null,this.usesPickingColorCache=!1,this.disabledPickingIndices=[]}get layer(){return this.component}_fetch(e,t){const n=this.layer,s=n?.props.fetch;return s?s(t,{propName:e,layer:n}):super._fetch(e,t)}_onResolve(e,t){const n=this.layer;if(n){const s=n.props.onDataLoad;e==="data"&&s&&s(t,{propName:e,layer:n})}}_onError(e,t){const n=this.layer;n&&n.raiseError(t,`loading ${e} of ${this.layer}`)}}const vI="layer.changeFlag",xI="layer.initialize",wI="layer.update",PI="layer.finalize",SI="layer.matched",Jd=2**24-1,EI=Object.freeze([]),CI=ss(({oldViewport:i,viewport:e})=>i.equals(e));let Ne=new Uint8ClampedArray(0);function eh(i){return i.rowIndexes||i.pickingColors||i.instancePickingColors}function wa(i){return i.rowIndexes}function Pa(i){return i.pickingColors||i.instancePickingColors}const LI={data:{type:"data",value:EI,async:!0},dataComparator:{type:"function",value:null,optional:!0},_dataDiff:{type:"function",value:i=>i&&i.__diff,optional:!0},dataTransform:{type:"function",value:null,optional:!0},onDataLoad:{type:"function",value:null,optional:!0},onError:{type:"function",value:null,optional:!0},fetch:{type:"function",value:(i,{propName:e,layer:t,loaders:n,loadOptions:s,signal:r})=>{const{resourceManager:o}=t.context;s=s||t.getLoadOptions(),n=n||t.props.loaders,r&&(s={...s,core:{...s?.core,fetch:{...s?.core?.fetch,signal:r}}});let a=o.contains(i);return!a&&!s&&(o.add({resourceId:i,data:gr(i,n),persistent:!1}),a=!0),a?o.subscribe({resourceId:i,onChange:c=>t.internalState?.reloadAsyncProp(e,c),consumerId:t.id,requestId:e}):gr(i,n,s)}},updateTriggers:{},visible:!0,pickable:!1,opacity:{type:"number",min:0,max:1,value:1},operation:"draw",onHover:{type:"function",value:null,optional:!0},onClick:{type:"function",value:null,optional:!0},onDragStart:{type:"function",value:null,optional:!0},onDrag:{type:"function",value:null,optional:!0},onDragEnd:{type:"function",value:null,optional:!0},coordinateSystem:"default",coordinateOrigin:{type:"array",value:[0,0,0],compare:!0},modelMatrix:{type:"array",value:null,compare:!0,optional:!0},wrapLongitude:!1,positionFormat:"XYZ",colorFormat:"RGBA",parameters:{type:"object",value:{},optional:!0,compare:2},loadOptions:{type:"object",value:null,optional:!0,ignore:!0},transitions:null,extensions:[],loaders:{type:"array",value:[],optional:!0,ignore:!0},getPolygonOffset:{type:"function",value:({layerIndex:i})=>[0,-i*100]},highlightedObjectIndex:null,autoHighlight:!1,highlightColor:{type:"accessor",value:[0,0,128,128]}};class et extends ro{constructor(){super(...arguments),this.internalState=null,this.lifecycle=Ii.NO_STATE,this.parent=null}static get componentName(){return Object.prototype.hasOwnProperty.call(this,"layerName")?this.layerName:""}get root(){let e=this;for(;e.parent;)e=e.parent;return e}toString(){return`${this.constructor.layerName||this.constructor.name}({id: '${this.props.id}'})`}project(e){he(this.internalState);const t=this.internalState.viewport||this.context.viewport,n=Dl(e,{viewport:t,modelMatrix:this.props.modelMatrix,coordinateOrigin:this.props.coordinateOrigin,coordinateSystem:this.props.coordinateSystem}),[s,r,o]=Ol(n,t.pixelProjectionMatrix);return e.length===2?[s,r]:[s,r,o]}unproject(e){return he(this.internalState),(this.internalState.viewport||this.context.viewport).unproject(e)}projectPosition(e,t){he(this.internalState);const n=this.internalState.viewport||this.context.viewport;return uC(e,{viewport:n,modelMatrix:this.props.modelMatrix,coordinateOrigin:this.props.coordinateOrigin,coordinateSystem:this.props.coordinateSystem,...t})}get isComposite(){return!1}get isDrawable(){return!0}setState(e){this.setChangeFlags({stateChanged:!0}),Object.assign(this.state,e),this.setNeedsRedraw()}setNeedsRedraw(){this.internalState&&(this.internalState.needsRedraw=!0)}setNeedsUpdate(){this.internalState&&(this.context.layerManager.setNeedsUpdate(String(this)),this.internalState.needsUpdate=!0)}get isLoaded(){return this.internalState?!this.internalState.isAsyncPropLoading():!1}get wrapLongitude(){return this.props.wrapLongitude}isPickable(){return this.props.pickable&&this.props.visible}getModels(){const e=this.state;return e&&(e.models||e.model&&[e.model])||[]}setShaderModuleProps(...e){for(const t of this.getModels())t.shaderInputs.setProps(...e)}getAttributeManager(){return this.internalState&&this.internalState.attributeManager}getCurrentLayer(){return this.internalState&&this.internalState.layer}getLoadOptions(){return this.props.loadOptions}use64bitPositions(){const{coordinateSystem:e}=this.props;return e==="default"||e==="lnglat"||e==="cartesian"}onHover(e,t){return this.props.onHover&&this.props.onHover(e,t)||!1}onClick(e,t){return this.props.onClick&&this.props.onClick(e,t)||!1}nullPickingColor(){return[0,0,0]}encodePickingColor(e,t=[]){return t[0]=e+1&255,t[1]=e+1>>8&255,t[2]=e+1>>8>>8&255,t}decodePickingColor(e){he(e instanceof Uint8Array);const[t,n,s]=e;return t+n*256+s*65536-1}getNumInstances(){return Number.isFinite(this.props.numInstances)?this.props.numInstances:this.state&&this.state.numInstances!==void 0?this.state.numInstances:JM(this.props.data)}getStartIndices(){return this.props.startIndices?this.props.startIndices:this.state&&this.state.startIndices?this.state.startIndices:null}getBounds(){return this.getAttributeManager()?.getBounds(["positions","instancePositions"])}getShaders(e){e=Qd(e,{disableWarnings:!0,modules:this.context.defaultShaderModules});for(const t of this.props.extensions)e=Qd(e,t.getShaders.call(this,t));return e}shouldUpdateState(e){return e.changeFlags.propsOrDataChanged}updateState(e){const t=this.getAttributeManager(),{dataChanged:n}=e.changeFlags;if(n&&t)if(Array.isArray(n))for(const s of n)t.invalidateAll(s);else t.invalidateAll();if(t){const{props:s}=e,r=this.internalState.hasPickingBuffer,o=Number.isInteger(s.highlightedObjectIndex)||!!s.pickable||s.extensions.some(a=>a.getNeedsPickingBuffer.call(this,a));if(r!==o){this.internalState.hasPickingBuffer=o;const a=eh(t.attributes);a&&(o&&a.constant&&(a.constant=!1,t.invalidate(a.id)),!a.value&&!o&&(a.constant=!0,a.value=wa(t.attributes)?[Ar]:[0,0,0]))}}}finalizeState(e){for(const n of this.getModels())n.destroy();const t=this.getAttributeManager();t&&t.finalize(),this.context&&this.context.resourceManager.unsubscribe({consumerId:this.id}),this.internalState&&(this.internalState.uniformTransitions.clear(),this.internalState.finalize())}draw(e){for(const t of this.getModels())t.draw(e.renderPass)}getPickingInfo({info:e,mode:t,sourceLayer:n}){const{index:s}=e;return s>=0&&Array.isArray(this.props.data)&&(e.object=this.props.data[s]),e}raiseError(e,t){t&&(e=new Error(`${t}: ${e.message}`,{cause:e})),this.props.onError?.(e)||this.context?.onError?.(e,this)}getNeedsRedraw(e={clearRedrawFlags:!1}){return this._getNeedsRedraw(e)}needsUpdate(){return this.internalState?this.internalState.needsUpdate||this.hasUniformTransition()||this.shouldUpdateState(this._getUpdateParams()):!1}hasUniformTransition(){return this.internalState?.uniformTransitions.active||!1}activateViewport(e){if(!this.internalState)return;const t=this.internalState.viewport;this.internalState.viewport=e,(!t||!CI({oldViewport:t,viewport:e}))&&(this.setChangeFlags({viewportChanged:!0}),this.isComposite?this.needsUpdate()&&this.setNeedsUpdate():this._update())}invalidateAttribute(e="all"){const t=this.getAttributeManager();t&&(e==="all"?t.invalidateAll():t.invalidate(e))}updateAttributes(e){let t=!1;for(const n in e)e[n].layoutChanged()&&(t=!0);for(const n of this.getModels())this._setModelAttributes(n,e,t)}_updateAttributes(){const e=this.getAttributeManager();if(!e)return;const t=this.props,n=this.getNumInstances(),s=this.getStartIndices();e.update({data:t.data,numInstances:n,startIndices:s,props:t,transitions:t.transitions,buffers:t.data.attributes,context:this});const r=e.getChangedAttributes({clearChangedFlags:!0});this.updateAttributes(r)}_updateAttributeTransition(){const e=this.getAttributeManager();e&&e.updateTransition()}_updateUniformTransition(){const{uniformTransitions:e}=this.internalState;if(e.active){const t=e.update(),n=Object.create(this.props);for(const s in t)Object.defineProperty(n,s,{value:t[s]});return n}return this.props}calculateInstancePickingColors(e,{numInstances:t}){if(e.constant)return;const n=Math.floor(Ne.length/4);this.internalState.usesPickingColorCache=!0;const s=t>0&&Ne[0]===0;if(n<t||s){t>Jd&&K.warn("Layer has too many data objects. Picking might not be able to distinguish all objects.")(),Ne=Zi.allocate(Ne,t,{size:4,copy:!0,maxCount:Math.max(t,Jd)});const r=Math.floor(Ne.length/4),o=[0,0,0],a=s?0:n;for(let c=a;c<r;c++)this.encodePickingColor(c,o),Ne[c*4+0]=o[0],Ne[c*4+1]=o[1],Ne[c*4+2]=o[2],Ne[c*4+3]=0}e.value=Ne.subarray(0,t*4)}_setModelAttributes(e,t,n=!1){if(!Object.keys(t).length)return;const s=this.getAttributeManager();if(s?.hasBufferGroups()){this._setGroupedModelAttributes(e,s,t);return}if(n){const c=this.getAttributeManager();e.setBufferLayout(c.getBufferLayouts(e)),t=c.getAttributes()}const r=e.userData?.excludeAttributes||{},o={},a={};for(const c in t){if(r[c])continue;const l=t[c].getValue();for(const u in l){const f=l[u];f instanceof q?t[c].settings.isIndexed?e.setIndexBuffer(f):o[u]=f:f&&(a[u]=f)}}e.setAttributes(o),e.setConstantAttributes(a)}_setGroupedModelAttributes(e,t,n){const s=e.userData?.excludeAttributes||{},r=t.getBufferGroupBindings(n,e,s);e.setBufferLayout(r.bufferLayouts);const o={...r.buffers},a={},c=t.getAttributes();for(const l in c){if(s[l]||r.groupedAttributeIds.has(l))continue;const u=c[l],f=u.getValue();for(const d in f){const h=f[d];h instanceof q?u.settings.isIndexed?e.setIndexBuffer(h):o[d]=h:h&&(a[d]=h)}}e.setAttributes(o),e.setConstantAttributes(a)}disablePickingIndex(e){const t=this.props.data;if(!("attributes"in t)){this._disablePickingIndex(e);return}const n=this.getAttributeManager().attributes,s=wa(n),r=Pa(n),o=s&&t.attributes&&t.attributes[s.id];if(o&&o.value){const c=o.value;for(let l=0;l<t.length;l++){const u=s.getVertexOffset(l);c[u]===e&&this._disablePickingIndex(l)}return}const a=r&&t.attributes&&t.attributes[r.id];if(a&&a.value){const c=a.value,l=this.encodePickingColor(e);for(let u=0;u<t.length;u++){const f=r.getVertexOffset(u);c[f]===l[0]&&c[f+1]===l[1]&&c[f+2]===l[2]&&this._disablePickingIndex(u)}}else this._disablePickingIndex(e)}_disablePickingIndex(e){const t=this.getAttributeManager().attributes,n=wa(t);if(n){const a=n.getVertexOffset(e),c=n.getVertexOffset(e+1),l=new Uint32Array(c-a);l.fill(Ar),n.buffer.write(l,a*l.BYTES_PER_ELEMENT);return}const s=Pa(t);if(!s){this.internalState&&RE(this.internalState.disabledPickingIndices,e);return}const r=s.getVertexOffset(e),o=s.getVertexOffset(e+1);s.buffer.write(new Uint8Array(o-r),r)}restorePickingColors(){const e=this.getAttributeManager().attributes,t=eh(e);if(!t){this.internalState&&(this.internalState.disabledPickingIndices.length=0);return}const n=Pa(e);this.internalState.usesPickingColorCache&&n&&n.value.buffer!==Ne.buffer&&(n.value=Ne.subarray(0,n.value.length)),t.updateSubBuffer({startOffset:0})}_initialize(){he(!this.internalState),Se(xI,this);const e=this._getAttributeManager();this.internalState=new bI({attributeManager:e,layer:this}),this._clearChangeFlags(),this.state={},Object.defineProperty(this.state,"attributeManager",{get:()=>(K.deprecated("layer.state.attributeManager","layer.getAttributeManager()")(),e)}),this.internalState.uniformTransitions=new jM(this.context.timeline),this.internalState.onAsyncPropUpdated=this._onAsyncPropUpdated.bind(this),this.internalState.setAsyncProps(this.props),this.initializeState(this.context);for(const t of this.props.extensions)t.initializeState.call(this,this.context,t);this.setChangeFlags({dataChanged:"init",propsChanged:"init",viewportChanged:!0,extensionsChanged:!0}),this._update()}_transferState(e){Se(SI,this,this===e);const{state:t,internalState:n}=e;this!==e&&(this.internalState=n,this.state=t,this.internalState.setAsyncProps(this.props),this._diffProps(this.props,this.internalState.getOldProps()))}_update(){const e=this.needsUpdate();if(Se(wI,this,e),!e)return;this.context.stats.get("Layer updates").incrementCount();const t=this.props,n=this.context,s=this.internalState,r=n.viewport,o=this._updateUniformTransition();s.propsInTransition=o,n.viewport=s.viewport||r,this.props=o;try{const a=this._getUpdateParams(),c=this.getModels();if(n.device)this.updateState(a);else try{this.updateState(a)}catch{}for(const u of this.props.extensions)u.updateState.call(this,a,u);this.setNeedsRedraw(),this._updateAttributes();const l=this.getModels()[0]!==c[0];this._postUpdate(a,l)}finally{n.viewport=r,this.props=t,this._clearChangeFlags(),s.needsUpdate=!1,s.resetOldProps()}}_finalize(){Se(PI,this),this.finalizeState(this.context);for(const e of this.props.extensions)e.finalizeState.call(this,this.context,e)}_drawLayer({renderPass:e,shaderModuleProps:t=null,uniforms:n={},parameters:s={}}){this._updateAttributeTransition();const r=this.props,o=this.context;this.props=this.internalState.propsInTransition||r;try{t&&this.setShaderModuleProps(t);const{getPolygonOffset:a}=this.props,c=a&&a(n)||[0,0];o.device instanceof ai&&o.device.setParametersWebGL({polygonOffset:c});const l=o.device instanceof ai?null:TI(s);if(AI(this.getModels(),e,s,l),o.device instanceof ai)o.device.withParametersWebGL(s,()=>{const u={renderPass:e,shaderModuleProps:t,uniforms:n,parameters:s,context:o};for(const f of this.props.extensions)f.draw.call(this,u,f);this.draw(u)});else{l?.renderPassParameters&&e.setParameters(l.renderPassParameters);const u={renderPass:e,shaderModuleProps:t,uniforms:n,parameters:s,context:o};for(const f of this.props.extensions)f.draw.call(this,u,f);this.draw(u)}}finally{this.props=r}}getChangeFlags(){return this.internalState?.changeFlags}setChangeFlags(e){if(!this.internalState)return;const{changeFlags:t}=this.internalState;for(const s in e)if(e[s]){let r=!1;switch(s){case"dataChanged":const o=e[s],a=t[s];o&&Array.isArray(a)&&(t.dataChanged=Array.isArray(o)?a.concat(o):o,r=!0);default:t[s]||(t[s]=e[s],r=!0)}r&&Se(vI,this,s,e)}const n=!!(t.dataChanged||t.updateTriggersChanged||t.propsChanged||t.extensionsChanged);t.propsOrDataChanged=n,t.somethingChanged=n||t.viewportChanged||t.stateChanged}_clearChangeFlags(){this.internalState.changeFlags={dataChanged:!1,propsChanged:!1,updateTriggersChanged:!1,viewportChanged:!1,stateChanged:!1,extensionsChanged:!1,propsOrDataChanged:!1,somethingChanged:!1}}_diffProps(e,t){const n=HM(e,t);if(n.updateTriggersChanged)for(const s in n.updateTriggersChanged)n.updateTriggersChanged[s]&&this.invalidateAttribute(s);if(n.transitionsChanged)for(const s in n.transitionsChanged)this.internalState.uniformTransitions.add(s,t[s],e[s],e.transitions?.[s]);return this.setChangeFlags(n)}validateProps(){WM(this.props)}updateAutoHighlight(e){this.props.autoHighlight&&!Number.isInteger(this.props.highlightedObjectIndex)&&this._updateAutoHighlight(e)}_updateAutoHighlight(e){const t={highlightedObjectColor:e.picked?e.color:null},{highlightColor:n}=this.props;e.picked&&typeof n=="function"&&(t.highlightColor=n(e)),this.setShaderModuleProps({picking:t}),this.setNeedsRedraw()}_getAttributeManager(){const e=this.context;return new NM(e.device,{id:this.props.id,stats:e.stats,timeline:e.timeline})}_postUpdate(e,t){const{props:n,oldProps:s}=e,r=this.state.model;r?.isInstanced&&r.setInstanceCount(this.getNumInstances());const{autoHighlight:o,highlightedObjectIndex:a,highlightColor:c}=n;if(t||s.autoHighlight!==o||s.highlightedObjectIndex!==a||s.highlightColor!==c){const l={};Array.isArray(c)&&(l.highlightColor=c),(t||s.autoHighlight!==o||a!==s.highlightedObjectIndex)&&(l.highlightedObjectColor=Number.isFinite(a)&&a>=0?this.encodePickingColor(a):null),this.setShaderModuleProps({picking:l})}}_getUpdateParams(){return{props:this.props,oldProps:this.internalState.getOldProps(),context:this.context,changeFlags:this.internalState.changeFlags}}_getNeedsRedraw(e){if(!this.internalState)return!1;let t=!1;t=t||this.internalState.needsRedraw&&this.id;const n=this.getAttributeManager(),s=n?n.getNeedsRedraw(e):!1;if(t=t||s,t)for(const r of this.props.extensions)r.onNeedsRedraw.call(this,r);return this.internalState.needsRedraw=this.internalState.needsRedraw&&!e.clearRedrawFlags,t}_onAsyncPropUpdated(){this._diffProps(this.props,this.internalState.getOldProps()),this.setNeedsUpdate()}}et.defaultProps=LI;et.layerName="Layer";function TI(i){const{blendConstant:e,...t}=i;return e?{pipelineParameters:t,renderPassParameters:{blendConstant:e}}:{pipelineParameters:t}}function AI(i,e,t,n){for(const s of i)s.device.type==="webgpu"?(MI(s,e),s.setParameters({...s.parameters,...n?.pipelineParameters})):s.setParameters(t)}function MI(i,e){const t=e.props.framebuffer||(e.framebuffer??null);if(!t)return;const n=t.colorAttachments.map(o=>o?.texture?.format??null),s=t.depthStencilAttachment?.texture?.format,r=i;(!II(r.props.colorAttachmentFormats,n)||r.props.depthStencilAttachmentFormat!==s)&&(r.props.colorAttachmentFormats=n,r.props.depthStencilAttachmentFormat=s,r._setPipelineNeedsUpdate("attachment formats"))}function II(i,e){if(i===e)return!0;if(!i||!e||i.length!==e.length)return!1;for(let t=0;t<i.length;t++)if(i[t]!==e[t])return!1;return!0}const RI="compositeLayer.renderLayers";class Ql extends et{get isComposite(){return!0}get isDrawable(){return!1}get isLoaded(){return super.isLoaded&&this.getSubLayers().every(e=>e.isLoaded)}getSubLayers(){return this.internalState&&this.internalState.subLayers||[]}initializeState(e){}setState(e){super.setState(e),this.setNeedsUpdate()}getPickingInfo({info:e}){const{object:t}=e;return t&&t.__source&&t.__source.parent&&t.__source.parent.id===this.id&&(e.object=t.__source.object,e.index=t.__source.index),e}filterSubLayer(e){return!0}shouldRenderSubLayer(e,t){return t&&t.length}getSubLayerClass(e,t){const{_subLayerProps:n}=this.props;return n&&n[e]&&n[e].type||t}getSubLayerRow(e,t,n){return e.__source={parent:this,object:t,index:n},e}getSubLayerAccessor(e){if(typeof e=="function"){const t={index:-1,data:this.props.data,target:[]};return(n,s)=>n&&n.__source?(t.index=n.__source.index,e(n.__source.object,t)):e(n,s)}return e}getSubLayerProps(e={}){const{opacity:t,pickable:n,visible:s,parameters:r,getPolygonOffset:o,highlightedObjectIndex:a,autoHighlight:c,highlightColor:l,coordinateSystem:u,coordinateOrigin:f,wrapLongitude:d,positionFormat:h,modelMatrix:g,extensions:p,fetch:m,operation:_,_subLayerProps:v}=this.props,b={id:"",updateTriggers:{},opacity:t,pickable:n,visible:s,parameters:r,getPolygonOffset:o,highlightedObjectIndex:a,autoHighlight:c,highlightColor:l,coordinateSystem:u,coordinateOrigin:f,wrapLongitude:d,positionFormat:h,modelMatrix:g,extensions:p,fetch:m,operation:_},x=v&&e.id&&v[e.id],w=x&&x.updateTriggers,C=e.id||"sublayer";if(x){const B=this.props[$t],F=e.type?e.type._propTypes:{};for(const D in x){const k=F[D]||B[D];k&&k.type==="accessor"&&(x[D]=this.getSubLayerAccessor(x[D]))}}Object.assign(b,e,x),b.id=`${this.props.id}-${C}`,b.updateTriggers={all:this.props.updateTriggers?.all,...e.updateTriggers,...w};for(const B of p){const F=B.getSubLayerProps.call(this,B);F&&Object.assign(b,F,{updateTriggers:Object.assign(b.updateTriggers,F.updateTriggers)})}return b}_updateAutoHighlight(e){for(const t of this.getSubLayers())t.updateAutoHighlight(e)}_getAttributeManager(){return null}_postUpdate(e,t){let n=this.internalState.subLayers;const s=!n||this.needsUpdate();if(s){const r=this.renderLayers();n=Ul(r,Boolean),this.internalState.subLayers=n}Se(RI,this,s,n);for(const r of n)r.parent=this}}Ql.layerName="CompositeLayer";const Ci=Math.PI/180,th=180/Math.PI,OI=1,Xs=6370972,Ft=256,ih=.75,nh=1.15;function sh(i){const e=Xi(i+180,360)-180;return Math.abs(e)<OI}function kI(){const i=Ft/Xs,e=Math.PI/180*Ft;return{unitsPerMeter:[i,i,i],unitsPerMeter2:[0,0,0],metersPerUnit:[1/i,1/i,1/i],unitsPerDegree:[e,e,i],unitsPerDegree2:[0,0,0],degreesPerUnit:[1/e,1/e,1/i]}}class Jl extends an{constructor(e={}){const{longitude:t=0,bearing:n=0,pitch:s=0,zoom:r=0,nearZMultiplier:o=.5,farZMultiplier:a=1,resolution:c=10}=e;let{latitude:l=0,height:u,altitude:f=1.5,fovy:d}=e;l=Math.max(Math.min(l,90),-90),u=u||1,d?f=Rl(d):d=Yn(f);const h=Math.max(Math.min(l,Ye),-Ye),g=Math.pow(2,r-we(h)),p=s*Ci,m=e.nearZ??o,_=e.farZ??(f+Ft*2*g/u/Math.max(Math.cos(p),.1))*a,v=new Je().lookAt({eye:[0,-f,0],up:[0,0,1]}).rotateX(-p).rotateY(-n*Ci).rotateX(l*Ci).rotateZ(-t*Ci).scale(g/u);super({...e,height:u,viewMatrix:v,longitude:t,latitude:l,zoom:r,distanceScales:kI(),fovy:d,focalDistance:f,near:m,far:_}),this.scale=g,this.latitude=l,this.longitude=t,this.bearing=n,this.pitch=s,this.fovy=d,this.resolution=c}get projectionMode(){return Re.GLOBE}getDistanceScales(){return this.distanceScales}getBounds(e={}){const t={targetZ:e.z||0},n=this.unproject([0,this.height/2],t),s=this.unproject([this.width/2,0],t),r=this.unproject([this.width,this.height/2],t),o=this.unproject([this.width/2,this.height],t);return r[0]<this.longitude&&(r[0]+=360),n[0]>this.longitude&&(n[0]-=360),[Math.min(n[0],r[0],s[0],o[0]),Math.min(n[1],r[1],s[1],o[1]),Math.max(n[0],r[0],s[0],o[0]),Math.max(n[1],r[1],s[1],o[1])]}_getRayToGlobe(e,{topLeft:t=!0,targetZ:n}={}){const[s,r]=e,o=t?r:this.height-r,{pixelUnprojectionMatrix:a}=this,c=Sa(a,[s,o,-1,1]),l=Sa(a,[s,o,1,1]),u=((n||0)/Xs+1)*Ft,f=Vo(vp([],c,l)),d=Vo(c),h=Vo(l),p=4*((4*d*h-(f-d-h)**2)/16)/f;return{rayStartPosition:c,rayEndPosition:l,radius:u,rayLengthSquared:f,rayStartDistanceSquared:d,distanceToCenterSquared:p}}_getRayDistanceToGlobeCenterRatio(e,t){const{distanceToCenterSquared:n,radius:s}=this._getRayToGlobe(e,t);return Math.sqrt(Math.max(0,n))/s}getZoomAnchorStrength(e){const t=this._getRayDistanceToGlobeCenterRatio(e);if(t>=nh)return 0;const n=Math.max(0,Math.min(1,(t-ih)/(nh-ih)));return 1-n*n*(3-2*n)}unproject(e,{topLeft:t=!0,targetZ:n}={}){const[s,r,o]=e,a=t?r:this.height-r,{pixelUnprojectionMatrix:c}=this;let l;if(Number.isFinite(o))l=Sa(c,[s,a,o,1]);else{const{rayStartPosition:h,rayEndPosition:g,radius:p,rayLengthSquared:m,rayStartDistanceSquared:_,distanceToCenterSquared:v}=this._getRayToGlobe(e,{topLeft:t,targetZ:n}),b=Math.sqrt(_-v),x=Math.sqrt(Math.max(0,p*p-v)),w=(b-x)/Math.sqrt(m);l=YP([],h,g,w)}const[u,f,d]=this.unprojectPosition(l);return Number.isFinite(o)?[u,f,d]:Number.isFinite(n)?[u,f,n]:[u,f]}projectPosition(e){const[t,n,s=0]=e,r=t*Ci,o=n*Ci,a=Math.cos(o),c=(s/Xs+1)*Ft;return[Math.sin(r)*a*c,-Math.cos(r)*a*c,Math.sin(o)*c]}unprojectPosition(e){const[t,n,s]=e,r=Pr(e),o=Math.asin(s/r),c=Math.atan2(t,-n)*th,l=o*th,u=(r/Ft-1)*Xs;return[c,l,u]}projectFlat(e){return e}unprojectFlat(e){return e}panByPosition(e,t,n){if(!n){let d=this.getZoomAnchorStrength(t);if(d===0)return{longitude:this.longitude,latitude:this.latitude};const h=this.unproject(t),g=Xi(e[0]-h[0]+180,360)-180,p=e[1]-h[1],m=Math.abs(h[1])>Ye||Math.abs(g)>90;if(sh(this.bearing)&&m)return{longitude:this.longitude,latitude:this.latitude};if(sh(this.bearing)&&p!==0){const x=((p>0?Ye:-Ye)-this.latitude)/p;d=Math.min(d,Math.max(0,x))}const _=this.longitude+g*d,v=Math.max(Math.min(this.latitude+p*d,90),-90);return{longitude:_,latitude:v}}const[s,r,o]=e,c=.25/Math.pow(2,this.zoom-we(this.latitude)),l=s+c*(n[0]-t[0]);let u=r-c*(n[1]-t[1]);u=Math.max(Math.min(u,90),-90);const f={longitude:l,latitude:u,zoom:o-we(r)};return f.zoom+=we(f.latitude),f}}Jl.displayName="GlobeViewport";function we(i,e){e&&(i=Math.max(Math.min(i,Ye),-Ye));const t=Math.PI*Math.cos(i*Math.PI/180);return Math.log2(t)}function Sa(i,e){const t=rn([],e,i);return Tl(t,t,1/t[3]),t}const Li=Math.PI/180,Ea=180/Math.PI;class se{static toPosition(e,t){const n=t*Li,s=e*Li,r=Math.cos(n);return[r*Math.cos(s),r*Math.sin(s),Math.sin(n)]}static toLngLat(e){return[Math.atan2(e[1],e[0])*Ea,Math.asin(me(e[2],-1,1))*Ea]}static tangentBasis(e,t){const n=t*Li,s=e*Li,r=Math.sin(n),o=Math.cos(n),a=Math.sin(s),c=Math.cos(s);return{N:[-r*c,-r*a,o],E:[-a,c,0]}}static upVector(e,t,n){const{N:s,E:r}=se.tangentBasis(e,t),o=n*Li,a=Math.cos(o),c=Math.sin(o);return[s[0]*a+r[0]*c,s[1]*a+r[1]*c,s[2]*a+r[2]*c]}static bearing(e,t,n){const{N:s,E:r}=se.tangentBasis(t,n);return Math.atan2(ki(e,r),ki(e,s))*Ea}static cameraFrame(e,t,n){const s=se.toPosition(e,t),r=se.upVector(e,t,n),{N:o,E:a}=se.tangentBasis(e,t),c=n*Li,l=Math.cos(c),u=Math.sin(c),f=[a[0]*l-o[0]*u,a[1]*l-o[1]*u,a[2]*l-o[2]*u];return{position:s,up:r,axisHorizontal:at([],s,f),axisVertical:at([],s,r),longitude:e,latitude:t,bearing:n}}static angularDistance(e,t){const n=se.toPosition(e.longitude,e.latitude),s=se.toPosition(t.longitude,t.latitude);return Math.acos(me(ki(n,s),-1,1))}static greatCircleAxis(e,t){const n=se.toPosition(e.longitude,e.latitude),s=se.toPosition(t.longitude,t.latitude);return ac([],at([],n,s))}static rotate(e,t,n){const s=new G2().fromAxisRotation(t,n);return El([],e,s)}static rotateFrame(e,t,n,s){let r=se.rotate(e.position,e.axisHorizontal,t);r=se.rotate(r,e.axisVertical,n);let o=se.rotate(e.up,e.axisHorizontal,t);o=se.rotate(o,e.axisVertical,n);const[a,c]=se.toLngLat(r),l=s?0:se.bearing(o,a,c);return{...e,position:r,up:o,longitude:a,latitude:c,bearing:l}}static rotateFrameToMatch(e,t,n,s=1){const r=se.toPosition(...t),o=se.toPosition(...n);let a=at([],r,o);const c=Pr(a),l=me(ki(r,o),-1,1);if(c<1e-12){if(l>0)return e;a=at([],r,e.up),Pr(a)<1e-12&&(a=at([],r,e.axisVertical))}ac(a,a);const u=Math.atan2(c,l)*me(s,0,1),f=se.rotate(e.position,a,u),d=se.rotate(e.up,a,u),[h,g]=se.toLngLat(f);return{...e,position:f,up:d,longitude:h,latitude:g,bearing:se.bearing(d,h,g)}}}const BI=1/(1-Math.exp(-5)),DI=i=>(1-Math.exp(-5*i))*BI;class FI extends $l{constructor(e){const t="axis"in e;super({compare:["longitude","latitude"],extract:t?["longitude","latitude","zoom","bearing"]:["longitude","latitude","zoom"],required:["longitude","latitude"]}),t?(this._mode="rotation",this._axis=e.axis,this._totalAngle=e.totalAngle):(this._mode="linear",this._targetLongitude=e.targetLongitude)}initializeProps(e,t){const n=super.initializeProps(e,t);return this._startZoom=e.zoom,this._mode==="rotation"?this._startFrame={...se.cameraFrame(e.longitude,e.latitude,e.bearing||0),axisHorizontal:this._axis}:n.end.longitude=this._targetLongitude,n}interpolateProps(e,t,n){if(this._mode==="rotation"){const{longitude:a,latitude:c,bearing:l}=se.rotateFrame(this._startFrame,this._totalAngle*n,0),u=this._startZoom+we(c,!0)-we(this._startFrame.latitude,!0);return{bearing:l,longitude:a,latitude:c,zoom:u}}const s=e.longitude+(t.longitude-e.longitude)*n,r=e.latitude+(t.latitude-e.latitude)*n,o=this._startZoom+we(r,!0)-we(e.latitude,!0);return{longitude:s,latitude:r,zoom:o}}}const Ri=Math.PI/180,zI=180/Math.PI;function rh(i,e=0){const t=Math.min(180,i)*Ri;return Ft*2*Math.sin(t/2)*Math.pow(2,e)}function Ti(i,e=0){const t=i/Math.pow(2,e);return Math.asin(Math.min(1,t/Ft/2))*2*zI}class NI extends rm{constructor(e){const{startPanPos:t,startPanCameraFrame:n,startPanAngularRate:s,...r}=e;r.normalize=!1,super(r);const o=this._state;t!==void 0&&(o.startPanPos=t),n!==void 0&&(o.startPanCameraFrame=n),s!==void 0&&(o.startPanAngularRate=s)}panStart({pos:e}){const{latitude:t,longitude:n,zoom:s,bearing:r=0}=this.getViewportProps(),o=se.cameraFrame(n,t,r),c=.25/Math.pow(2,s-we(t,!0))*Ri;return this._getUpdatedState({startPanPos:e,startPanCameraFrame:o,startPanAngularRate:c,startZoom:s})}pan({pos:e,startPos:t}){const n=this.getState(),s=n.startPanPos||t;if(!s)return this;const r=n.startPanCameraFrame,o=n.startPanAngularRate,a=n.startZoom??this.getViewportProps().zoom;if(!r||!o)return this;const c=s[0]-e[0],l=s[1]-e[1],u=c*o,f=-l*o,d=se.rotateFrame(r,u,f),h=a+we(d.latitude,!0)-we(r.latitude,!0);return this._getUpdatedState({longitude:d.longitude,latitude:d.latitude,bearing:d.bearing,zoom:h})}panEnd(){return this._getUpdatedState({startPanPos:null,startPanCameraFrame:null,startPanAngularRate:null,startZoom:null})}_panFromCenter(e){const{width:t,height:n}=this.getViewportProps(),s=[t/2,n/2];return this.panStart({pos:s}).pan({pos:[s[0]+e[0],s[1]+e[1]]}).panEnd()}applyConstraints(e){const t=e,n=t[ei];delete t[ei];const{latitude:s,maxBounds:r}=e;if(e.zoom=this._constrainZoom(e.zoom,e),n){const a=this.makeViewport(e),c=a.getZoomAnchorStrength(n.screenPosition);if(c>0){const l=a.unproject(n.screenPosition),u=se.cameraFrame(e.longitude,e.latitude,e.bearing||0),f=se.rotateFrameToMatch(u,[l[0],l[1]],[n.position[0],n.position[1]],c);e.longitude=f.longitude,e.latitude=f.latitude,e.bearing=f.bearing}}(e.longitude<-180||e.longitude>180)&&(e.longitude=Xi(e.longitude+180,360)-180),(e.bearing<-180||e.bearing>180)&&(e.bearing=Xi(e.bearing+180,360)-180),e.latitude=me(e.latitude,-90,90),e.pitch=me(e.pitch,e.minPitch,e.maxPitch);const o=r?Rr(e.width,e.height,e.maxBoundsPadding):null;if(r&&o&&(o.width>=0&&(e.longitude=me(e.longitude,r[0][0],r[1][0])),o.height>=0&&(e.latitude=me(e.latitude,r[0][1],r[1][1]))),r&&o){const a=this.makeViewport({...e,bearing:0,pitch:0}),c=nm(a,[e.longitude,e.latitude],o),l=e.zoom-we(s),u=r[1][0]-r[0][0],f=r[1][1]-r[0][1];if(o.height>=0&&f>0&&f<180){const d=Math.min(Ti(o.height,l),f),h=o.height?d*c.bottom/o.height:Ti(c.bottom,l),g=o.height?d*c.top/o.height:Ti(c.top,l);e.latitude=me(e.latitude,r[0][1]+h,r[1][1]-g)}if(o.width>=0&&u>0&&u<360){const d=Math.min(Ti(o.width/Math.cos(e.latitude*Ri),l),u),h=o.width?d*c.left/o.width:Ti(c.left/Math.cos(e.latitude*Ri),l),g=o.width?d*c.right/o.width:Ti(c.right/Math.cos(e.latitude*Ri),l);e.longitude=me(e.longitude,r[0][0]+h,r[1][0]-g)}}return e.latitude=me(e.latitude,-90,90),e.latitude!==s&&(e.zoom+=we(e.latitude,!0)-we(s,!0)),e}_constrainZoom(e,t){t||(t=this.getViewportProps());const{maxZoom:n,maxBounds:s}=t;let{minZoom:r}=t;if(s!==null&&t.width>0&&t.height>0){const c=Rr(t.width,t.height,t.maxBoundsPadding),l=s[0][1],u=s[1][1],f=Math.sign(l)===Math.sign(u)?Math.min(Math.abs(l),Math.abs(u)):0,d=we(0),h=rh(s[1][0]-s[0][0])*Math.cos(f*Ri),g=rh(s[1][1]-s[0][1]);c.width>0&&h>0&&(r=Math.max(r,Math.log2(c.width/h)+d)),c.height>0&&g>0&&(r=Math.max(r,Math.log2(c.height/g)+d)),r>n&&(r=n)}const a=we(t.latitude,!0)-we(0,!0);return me(e,r+a,n+a)}}class Wm extends im{constructor(){super(...arguments),this.ControllerState=NI,this.transition={transitionDuration:300,transitionInterpolator:new Gl({transitionProps:{compare:["longitude","latitude","zoom","bearing","pitch"],required:["longitude","latitude","zoom"]}})},this.dragMode="pan",this._panHistory=[]}_onPanStart(e){return this._panHistory=[],super._onPanStart(e)}_onMultiPanStart(e){return this._panHistory=[],super._onMultiPanStart(e)}_onPanMove(e){if(!this.dragPan)return!1;const t=this.getCenter(e),n=this.controllerState.pan({pos:t});this.updateViewport(n,{transitionDuration:0},{isDragging:!0,isPanning:!0});const{longitude:s,latitude:r}=n.getViewportProps();return this._panHistory.push({longitude:s,latitude:r,timestamp:Date.now()}),this._panHistory.length>5&&this._panHistory.shift(),!0}_onPanMoveEnd(e){const{inertia:t}=this;if(this.dragPan&&t&&this._panHistory.length>=2){const s=this._panHistory[0],r=this._panHistory[this._panHistory.length-1],o=r.timestamp-s.timestamp;if(o>0){const a=this.controllerState.getViewportProps(),l=se.angularDistance(s,r)/o;if(l>1e-6){const u=l*t/2,f=se.greatCircleAxis(s,r),d=se.cameraFrame(a.longitude,a.latitude,a.bearing||0),h=se.rotateFrame({...d,axisHorizontal:f},u,0),g=h.longitude,p=me(h.latitude,-90,90),m=new FI({axis:f,totalAngle:u}),_=this.controllerState.panEnd();return this.updateViewport(_,{transitionInterpolator:m,transitionDuration:t,transitionEasing:DI,longitude:g,latitude:p},{isDragging:!1,isPanning:!0}),this._panHistory=[],!0}}}this._panHistory=[];const n=this.controllerState.panEnd();return this.updateViewport(n,null,{isDragging:!1,isPanning:!1}),!0}}const UI={cullMode:"back"};class Hm extends di{constructor(e={}){super({...e,parameters:{...UI,...e.parameters}})}getViewportType(e){return e.zoom>12?St:Jl}get ControllerType(){return Wm}}Hm.displayName="GlobeView";class eu{static get componentName(){return Object.prototype.hasOwnProperty.call(this,"extensionName")?this.extensionName:""}constructor(e){e&&(this.opts=e)}equals(e){return this===e?!0:this.constructor===e.constructor&&Me(this.opts,e.opts,1)}getShaders(e){return null}getSubLayerProps(e){const{defaultProps:t}=e.constructor,n={updateTriggers:{}};for(const s in t)if(s in this.props){const r=t[s],o=this.props[s];n[s]=o,r&&r.type==="accessor"&&(n.updateTriggers[s]=this.props.updateTriggers[s],typeof o=="function"&&(n[s]=this.getSubLayerAccessor(o)))}return n}initializeState(e,t){}updateState(e,t){}onNeedsRedraw(e){}getNeedsPickingBuffer(e){return!1}draw(e,t){}finalizeState(e,t){}}eu.defaultProps={};eu.extensionName="LayerExtension";const Ca={bearing:0,pitch:0,position:[0,0,0]},$I={speed:1.2,curve:1.414};class oh extends $l{constructor(e={}){super({compare:["longitude","latitude","zoom","bearing","pitch","position"],extract:["width","height","longitude","latitude","zoom","bearing","pitch","position"],required:["width","height","latitude","longitude","zoom"]}),this.opts={...$I,...e}}interpolateProps(e,t,n){const s=_E(e,t,n,this.opts);for(const r in Ca)s[r]=Ut(e[r]||Ca[r],t[r]||Ca[r],n);return s}getDuration(e,t){let{transitionDuration:n}=t;return n==="auto"&&(n=bE(e,t,this.opts)),n}}class Ym{constructor(e){this.indexStarts=[0],this.vertexStarts=[0],this.vertexCount=0,this.instanceCount=0;const{attributes:t={}}=e;this.typedArrayManager=Zi,this.attributes={},this._attributeDefs=t,this.opts=e,this.updateGeometry(e)}updateGeometry(e){Object.assign(this.opts,e);const{data:t,buffers:n={},getGeometry:s,geometryBuffer:r,positionFormat:o,dataChanged:a,normalize:c=!0}=this.opts;if(this.data=t,this.getGeometry=s,this.positionSize=r&&r.size||(o==="XY"?2:3),this.buffers=n,this.normalize=c,r&&(he(t.startIndices),this.getGeometry=this.getGeometryFromBuffer(r),c||(n.vertexPositions=r)),this.geometryBuffer=n.vertexPositions,Array.isArray(a))for(const l of a)this._rebuildGeometry(l);else this._rebuildGeometry()}updatePartialGeometry({startRow:e,endRow:t}){this._rebuildGeometry({startRow:e,endRow:t})}getGeometryFromBuffer(e){const t=e.value||e;return ArrayBuffer.isView(t)?Cm(t,{size:this.positionSize,offset:e.offset,stride:e.stride,startIndices:this.data.startIndices}):null}_allocate(e,t){const{attributes:n,buffers:s,_attributeDefs:r,typedArrayManager:o}=this;for(const a in r)if(a in s)o.release(n[a]),n[a]=null;else{const c=r[a];c.copy=t,n[a]=o.allocate(n[a],e,c)}}_forEachGeometry(e,t,n){const{data:s,getGeometry:r}=this,{iterable:o,objectInfo:a}=os(s,t,n);for(const c of o){a.index++;const l=r?r(c,a):null;e(l,a.index)}}_rebuildGeometry(e){if(!this.data)return;let{indexStarts:t,vertexStarts:n,instanceCount:s}=this;const{data:r,geometryBuffer:o}=this,{startRow:a=0,endRow:c=1/0}=e||{},l={};if(e||(t=[0],n=[0]),this.normalize||!o)this._forEachGeometry((f,d)=>{const h=f&&this.normalizeGeometry(f);l[d]=h,n[d+1]=n[d]+(h?this.getGeometrySize(h):0)},a,c),s=n[n.length-1];else if(n=r.startIndices,s=n[r.length]||0,ArrayBuffer.isView(o))s=s||o.length/this.positionSize;else if(o instanceof q){const f=this.positionSize*4;s=s||o.byteLength/f}else if(o.buffer){const f=o.stride||this.positionSize*4;s=s||o.buffer.byteLength/f}else if(o.value){const f=o.value,d=o.stride/f.BYTES_PER_ELEMENT||this.positionSize;s=s||f.length/d}this._allocate(s,!!e),this.indexStarts=t,this.vertexStarts=n,this.instanceCount=s;const u={};this._forEachGeometry((f,d)=>{const h=l[d]||f;u.vertexStart=n[d],u.indexStart=t[d];const g=d<n.length-1?n[d+1]:s;u.geometrySize=g-n[d],u.geometryIndex=d,this.updateGeometryAttributes(h,u)},a,c),this.vertexCount=t[t.length-1]}}const GI=typeof window<"u"?N.useLayoutEffect:N.useEffect;function Br(i,e){for(;i;){if(i===e)return!0;i=Object.getPrototypeOf(i)}return!1}const VI={position:"absolute",zIndex:-1};function qm(i,e){if(typeof i=="function")return i(e);if(Array.isArray(i))return i.map(t=>qm(t,e));if(oo(i)){if(jI(i))return e.style=VI,N.cloneElement(i,e);if(WI(i))return N.cloneElement(i,e)}return i}function oo(i){return N.isValidElement(i)}function jI(i){return i.props?.mapStyle}function WI(i){const e=i.type;return e&&e.deckGLViewProps}function zc(i){if(typeof i=="function")return N.createElement(di,{},i);if(Array.isArray(i))return i.map(zc);if(oo(i)){if(i.type===N.Fragment)return zc(i.props.children);if(Br(i.type,di))return i}return i}function HI({children:i,layers:e=[],views:t}){const n=[],s=[],r={};return N.Children.forEach(zc(i),o=>{if(oo(o)){const a=o.type;if(Br(a,et)){const c=YI(a,o.props);s.push(c)}else n.push(o);if(Br(a,di)&&a!==di&&o.props.id){const c=new a(o.props);r[c.id]=c}}else o&&n.push(o)}),Object.keys(r).length>0&&(Array.isArray(t)?t.forEach(o=>{r[o.id]=o}):t&&(r[t.id]=t),t=Object.values(r)),e=s.length>0?[s,e]:e,{layers:e,children:n,views:t}}function YI(i,e){const t={},n=i.defaultProps||{};for(const s in e)n[s]!==e[s]&&(t[s]=e[s]);return new i(t)}const qI=N.createContext();function ZI({children:i,deck:e,ContextProvider:t=qI.Provider}){const{viewManager:n}=e||{};if(!n||!n.views.length)return[];const s={},r=n.views[0].id;for(const o of i){let a=r,c=o;oo(o)&&Br(o.type,di)&&(a=o.props.id||r,c=o.props.children);const l=n.getViewport(a),u=n.getViewState(a);if(l){u.padding=l.padding;const{x:f,y:d,width:h,height:g}=l;c=qm(c,{x:f,y:d,width:h,height:g,viewport:l,viewState:u}),s[a]||(s[a]={viewport:l,children:[]}),s[a].children.push(c)}}return Object.keys(s).map(o=>{const{viewport:a,children:c}=s[o],{x:l,y:u,width:f,height:d}=a,h={position:"absolute",left:l,top:u,width:f,height:d},g=`view-${o}`,p=N.createElement("div",{key:g,id:g,style:h},...c),m={deck:e,viewport:a,container:e.canvas.offsetParent,eventManager:e.eventManager,onViewStateChange:v=>{v.viewId=o,e._onViewStateChange(v)},widgets:[]},_=`view-${o}-context`;return N.createElement(t,{key:_,value:m},p)})}const XI={mixBlendMode:null};function KI({width:i,height:e,style:t}){const n={position:"absolute",zIndex:0,left:0,top:0,width:i,height:e},s={left:0,top:0};if(t)for(const r in t)r in XI?s[r]=t[r]:n[r]=t[r];return{containerStyle:n,canvasStyle:s}}function QI(i){return{get deck(){return i.deck},pickObjectAsync:e=>i.deck.pickObjectAsync(e),pickObjectsAsync:e=>i.deck.pickObjectsAsync(e),pickObject:e=>i.deck.pickObject(e),pickMultipleObjects:e=>i.deck.pickMultipleObjects(e),pickObjects:e=>i.deck.pickObjects(e)}}function Zm(i){i.redrawReason&&(i.deck._drawLayers(i.redrawReason),i.redrawReason=null)}function JI(i,e){const t=i.deck;return!!(t&&e&&t.width===e.clientWidth&&t.height===e.clientHeight)}function eR(i,e,t){const n=new e({...t,_customRender:s=>{i.redrawReason=s;const r=n.device?.type==="webgpu",o=n.getViewports();i.lastRenderedViewports!==o&&((!r||JI(i,t.parent||null))&&i.forceUpdate(),!r)||Zm(i)}});return n}function tR(i,e){const[t,n]=N.useState(0),r=N.useRef({control:null,version:t,forceUpdate:()=>n(w=>w+1)}).current,o=N.useRef(null),a=N.useRef(null),c=N.useMemo(()=>HI(i),[i.layers,i.views,i.children]);let l=!0;const u=w=>l&&i.viewState?(r.viewStateUpdateRequested=w,null):(r.viewStateUpdateRequested=null,i.onViewStateChange?.(w)),f=w=>{l?r.interactionStateUpdateRequested=w:(r.interactionStateUpdateRequested=null,i.onInteractionStateChange?.(w))},d=N.useMemo(()=>{const w={widgets:[],...i,style:null,width:"100%",height:"100%",parent:o.current,canvas:a.current,layers:c.layers,onViewStateChange:u,onInteractionStateChange:f};return c.views&&(w.views=c.views),delete w._customRender,r.deck&&(r.deck.setProps(w),r.deck.isInitialized&&(r.lastRenderedViewports=r.deck.getViewports())),w},[i]);N.useEffect(()=>{const w=i.Deck||Zl;return r.deck=eR(r,w,{...d,parent:o.current,canvas:a.current}),()=>r.deck?.finalize()},[]),GI(()=>{Zm(r);const{viewStateUpdateRequested:w,interactionStateUpdateRequested:C}=r;w&&u(w),C&&f(C)}),N.useImperativeHandle(e,()=>QI(r),[]);const h=r.deck&&r.deck.isInitialized?r.deck.getViewports():void 0,{ContextProvider:g,width:p="100%",height:m="100%",id:_,style:v}=i,{containerStyle:b,canvasStyle:x}=N.useMemo(()=>KI({width:p,height:m,style:v}),[p,m,v]);if(!r.viewStateUpdateRequested&&r.lastRenderedViewports===h||r.version!==t){r.lastRenderedViewports=h,r.version=t;const w=ZI({children:c.children,deck:r.deck,ContextProvider:g}),C=N.createElement("canvas",{key:"canvas",id:_||"deckgl-overlay",ref:a,style:x}),B=N.createElement("div",{key:"deck-events-root",className:"deck-events-root",style:{width:p,height:m}},[C,w]),F=N.createElement("div",{key:"deck-widgets-root",className:"deck-widgets-root"});r.control=N.createElement("div",{id:`${_||"deckgl"}-wrapper`,ref:o,style:b},[B,F])}return l=!1,r.control}const iR=N.forwardRef(tR),nR=`struct ArcUniforms {
  greatCircle: f32,
  useShortestPath: f32,
  numSegments: f32,
  widthScale: f32,
  widthMinPixels: f32,
  widthMaxPixels: f32,
  widthUnits: i32,
};

@group(0) @binding(auto) var<uniform> arc: ArcUniforms;
`,ah=`layout(std140) uniform arcUniforms {
  bool greatCircle;
  bool useShortestPath;
  float numSegments;
  float widthScale;
  float widthMinPixels;
  float widthMaxPixels;
  highp int widthUnits;
} arc;
`,sR={name:"arc",source:nR,vs:ah,fs:ah,uniformTypes:{greatCircle:"f32",useShortestPath:"f32",numSegments:"f32",widthScale:"f32",widthMinPixels:"f32",widthMaxPixels:"f32",widthUnits:"i32"}},rR=`const ZERO_OFFSET: vec3<f32> = vec3<f32>(0.0, 0.0, 0.0);

struct Attributes {
  @location(0) instanceSourcePositions: vec3<f32>,
  @location(1) instanceSourcePositions64Low: vec3<f32>,
  @location(2) instanceTargetPositions: vec3<f32>,
  @location(3) instanceTargetPositions64Low: vec3<f32>,
  @location(4) instanceSourceColors: vec4<f32>,
  @location(5) instanceTargetColors: vec4<f32>,
  @location(6) instanceWidths: f32,
  @location(7) instanceHeights: f32,
  @location(8) instanceTilts: f32,
};

struct Varyings {
  @builtin(position) position: vec4<f32>,
  @location(0) color: vec4<f32>,
  @location(1) uv: vec2<f32>,
  @location(2) pickingColor: vec3<f32>,
  @location(3) isValid: f32,
};

fn paraboloid(
  distance: f32,
  sourceZ: f32,
  targetZ: f32,
  ratio: f32,
  height: f32
) -> f32 {
  let deltaZ = targetZ - sourceZ;
  let dh = distance * height;
  if (dh == 0.0) {
    return sourceZ + deltaZ * ratio;
  }
  let unitZ = deltaZ / dh;
  let p2 = unitZ * unitZ + 1.0;
  let dir = select(0.0, 1.0, deltaZ <= 0.0);
  let z0 = mix(sourceZ, targetZ, dir);
  let r = mix(ratio, 1.0 - ratio, dir);
  return sqrt(max(r * (p2 - r), 0.0)) * dh + z0;
}

fn getExtrusionOffset(lineClipspace: vec2<f32>, side: f32, width: f32) -> vec2<f32> {
  var direction = normalize(lineClipspace * project.viewportSize);
  direction = vec2<f32>(-direction.y, direction.x);
  return direction * side * width / 2.0;
}

fn getSegmentRatio(index: f32) -> f32 {
  return smoothstep(0.0, 1.0, index / max(arc.numSegments - 1.0, 1.0));
}

fn interpolateFlat(
  source: vec3<f32>,
  targetPosition: vec3<f32>,
  ratio: f32,
  height: f32,
  tiltDegrees: f32
) -> vec3<f32> {
  let distance = length(source.xy - targetPosition.xy);
  let z = paraboloid(distance, source.z, targetPosition.z, ratio, height);
  let tiltAngle = radians(tiltDegrees);
  let tiltDirection = normalize(targetPosition.xy - source.xy);
  let tilt = vec2<f32>(-tiltDirection.y, tiltDirection.x) * z * sin(tiltAngle);
  return vec3<f32>(mix(source.xy, targetPosition.xy, ratio) + tilt, z * cos(tiltAngle));
}

// Great circle interpolation
// http://www.movable-type.co.uk/scripts/latlong.html
fn getAngularDistance(source: vec2<f32>, targetPosition: vec2<f32>) -> f32 {
  let sourceRadians = radians(source);
  let targetRadians = radians(targetPosition);
  let sinHalfDelta = sin((sourceRadians - targetRadians) / 2.0);
  let sinHalfDeltaSquared = sinHalfDelta * sinHalfDelta;
  let a = sinHalfDeltaSquared.y +
    cos(sourceRadians.y) * cos(targetRadians.y) * sinHalfDeltaSquared.x;
  return 2.0 * asin(sqrt(a));
}

fn interpolateGreatCircle(
  source: vec3<f32>,
  targetPosition: vec3<f32>,
  source3D: vec3<f32>,
  target3D: vec3<f32>,
  angularDistance: f32,
  ratio: f32,
  height: f32
) -> vec3<f32> {
  var longitudeLatitude: vec2<f32>;

  // If the angular distance is PI, use linear interpolation. Otherwise use spherical interpolation.
  if (abs(angularDistance - PI) < 0.001) {
    longitudeLatitude = (1.0 - ratio) * source.xy + ratio * targetPosition.xy;
  } else {
    let a = sin((1.0 - ratio) * angularDistance);
    let b = sin(ratio * angularDistance);
    let p = source3D.yxz * a + target3D.yxz * b;
    longitudeLatitude = degrees(vec2<f32>(
      atan2(p.y, -p.x),
      atan2(p.z, length(p.xy))
    ));
  }

  let z = paraboloid(
    angularDistance * EARTH_RADIUS,
    source.z,
    targetPosition.z,
    ratio,
    height
  );
  return vec3<f32>(longitudeLatitude, z);
}

@vertex
fn vertexMain(
  attributes: Attributes,
  @builtin(vertex_index) vertexIndex: u32,
  @builtin(instance_index) instanceIndex: u32
) -> Varyings {
  geometry.worldPosition = attributes.instanceSourcePositions;
  geometry.worldPositionAlt = attributes.instanceTargetPositions;

  let segmentIndex = f32(vertexIndex / 2u);
  let segmentSide = select(-1.0, 1.0, vertexIndex % 2u == 1u);
  var segmentRatio = getSegmentRatio(segmentIndex);
  let previousRatio = getSegmentRatio(max(0.0, segmentIndex - 1.0));
  var nextRatio = getSegmentRatio(min(arc.numSegments - 1.0, segmentIndex + 1.0));
  // If this is the first point, use next - current as direction.
  var indexDirection = select(-1.0, 1.0, segmentIndex <= 0.0);
  var isValid = 1.0;

  var currentClip: vec4<f32>;
  var nextClip: vec4<f32>;

  if (
    (arc.greatCircle != 0.0 || project.projectionMode == PROJECTION_MODE_GLOBE) &&
    project.coordinateSystem == COORDINATE_SYSTEM_LNGLAT
  ) {
    let source = project_globe_(vec3<f32>(attributes.instanceSourcePositions.xy, 0.0));
    let targetPosition = project_globe_(vec3<f32>(attributes.instanceTargetPositions.xy, 0.0));
    let angularDistance = getAngularDistance(
      attributes.instanceSourcePositions.xy,
      attributes.instanceTargetPositions.xy
    );

    let previousPosition = interpolateGreatCircle(
      attributes.instanceSourcePositions,
      attributes.instanceTargetPositions,
      source,
      targetPosition,
      angularDistance,
      previousRatio,
      attributes.instanceHeights
    );
    var currentPosition = interpolateGreatCircle(
      attributes.instanceSourcePositions,
      attributes.instanceTargetPositions,
      source,
      targetPosition,
      angularDistance,
      segmentRatio,
      attributes.instanceHeights
    );
    var nextPosition = interpolateGreatCircle(
      attributes.instanceSourcePositions,
      attributes.instanceTargetPositions,
      source,
      targetPosition,
      angularDistance,
      nextRatio,
      attributes.instanceHeights
    );

    if (abs(currentPosition.x - previousPosition.x) > 180.0) {
      indexDirection = -1.0;
      isValid = 0.0;
    } else if (abs(currentPosition.x - nextPosition.x) > 180.0) {
      indexDirection = 1.0;
      isValid = 0.0;
    }
    nextPosition = select(nextPosition, previousPosition, indexDirection < 0.0);
    nextRatio = select(nextRatio, previousRatio, indexDirection < 0.0);

    if (isValid == 0.0) {
      // Split at the antimeridian.
      nextPosition.x += select(360.0, -360.0, nextPosition.x > 0.0);
      let ratio = (
        select(-180.0, 180.0, currentPosition.x > 0.0) - currentPosition.x
      ) / (nextPosition.x - currentPosition.x);
      currentPosition = mix(currentPosition, nextPosition, ratio);
      segmentRatio = mix(segmentRatio, nextRatio, ratio);
    }

    let currentPosition64Low = mix(
      attributes.instanceSourcePositions64Low,
      attributes.instanceTargetPositions64Low,
      segmentRatio
    );
    let nextPosition64Low = mix(
      attributes.instanceSourcePositions64Low,
      attributes.instanceTargetPositions64Low,
      nextRatio
    );
    let currentProjection = project_position_to_clipspace_and_commonspace(
      currentPosition,
      currentPosition64Low,
      ZERO_OFFSET
    );
    currentClip = currentProjection.clipPosition;
    nextClip = project_position_to_clipspace(nextPosition, nextPosition64Low, ZERO_OFFSET);
    geometry.position = currentProjection.commonPosition;
  } else {
    var sourceWorld = attributes.instanceSourcePositions;
    var targetWorld = attributes.instanceTargetPositions;
    if (arc.useShortestPath != 0.0) {
      sourceWorld.x = ((sourceWorld.x + 180.0) % 360.0) - 180.0;
      targetWorld.x = ((targetWorld.x + 180.0) % 360.0) - 180.0;
      let deltaLongitude = targetWorld.x - sourceWorld.x;
      if (deltaLongitude > 180.0) {
        targetWorld.x -= 360.0;
      }
      if (deltaLongitude < -180.0) {
        sourceWorld.x -= 360.0;
      }
    }

    let source = project_position_vec3_f64(
      sourceWorld,
      attributes.instanceSourcePositions64Low
    );
    let targetPosition = project_position_vec3_f64(
      targetWorld,
      attributes.instanceTargetPositions64Low
    );

    // Common x at longitude=-180.
    var antimeridianX = 0.0;
    if (arc.useShortestPath != 0.0) {
      if (project.projectionMode == PROJECTION_MODE_WEB_MERCATOR_AUTO_OFFSET) {
        antimeridianX = -(project.coordinateOrigin.x + 180.0) / 360.0 * TILE_SIZE;
      }
      let thresholdRatio = (antimeridianX - source.x) / (targetPosition.x - source.x);
      if (previousRatio <= thresholdRatio && nextRatio > thresholdRatio) {
        isValid = 0.0;
        indexDirection = sign(segmentRatio - thresholdRatio);
        segmentRatio = thresholdRatio;
      }
    }

    nextRatio = select(nextRatio, previousRatio, indexDirection < 0.0);
    var currentPosition = interpolateFlat(
      source,
      targetPosition,
      segmentRatio,
      attributes.instanceHeights,
      attributes.instanceTilts
    );
    var nextPosition = interpolateFlat(
      source,
      targetPosition,
      nextRatio,
      attributes.instanceHeights,
      attributes.instanceTilts
    );

    if (arc.useShortestPath != 0.0 && nextPosition.x < antimeridianX) {
      currentPosition.x += TILE_SIZE;
      nextPosition.x += TILE_SIZE;
    }

    currentClip = project_common_position_to_clipspace(vec4<f32>(currentPosition, 1.0));
    nextClip = project_common_position_to_clipspace(vec4<f32>(nextPosition, 1.0));
    geometry.position = vec4<f32>(currentPosition, 1.0);
  }

  geometry.uv = vec2<f32>(segmentRatio, segmentSide);
  geometry.pickingColor = picking_getPickingColorFromIndex(instanceIndex);

  let widthPixels = clamp(
    project_unit_size_to_pixel(attributes.instanceWidths * arc.widthScale, arc.widthUnits),
    arc.widthMinPixels,
    arc.widthMaxPixels
  );
#ifdef ANTIALIASING
  var offset = getExtrusionOffset(
#else
  let offset = getExtrusionOffset(
#endif
    (nextClip.xy - currentClip.xy) * indexDirection,
    segmentSide,
    widthPixels
  );
#ifdef ANTIALIASING
  let halfWidthPixels = length(offset);
  if (halfWidthPixels > 0.0) {
    // Keep the declared edge at abs(uv.y) == 1 while rasterizing the outer half of the centered
    // one-device-pixel coverage ramp.
    let coverageScale = 1.0 + 0.5 / project.devicePixelRatio / halfWidthPixels;
    offset *= coverageScale;
    geometry.uv.y *= coverageScale;
  }
#endif

  var output: Varyings;
  output.position = currentClip + vec4<f32>(project_pixel_size_to_clipspace(offset), 0.0, 0.0);
  let color = mix(attributes.instanceSourceColors, attributes.instanceTargetColors, segmentRatio);
  output.color = vec4<f32>(color.rgb, color.a * layer.opacity);
  output.uv = geometry.uv;
  output.pickingColor = geometry.pickingColor;
  output.isValid = isValid;
  return output;
}

@fragment
fn fragmentMain(varyings: Varyings) -> @location(0) vec4<f32> {
#ifdef ANTIALIASING
  let edgeCoord = abs(varyings.uv.y);
  let edgePixels = (1.0 - edgeCoord) / max(fwidth(edgeCoord), 1e-6);
#endif

  if (varyings.isValid == 0.0) {
    discard;
  }

#ifdef ANTIALIASING
  // Fragments outside the coverage ramp must not write depth or picking colors.
  if (edgePixels <= -SMOOTH_EDGE_RADIUS) {
    discard;
  }
#endif
  var color = varyings.color;
#ifdef ANTIALIASING
  // Feather one device pixel across the width. Arc segments meet lengthwise, so only soften the
  // two outer edges of the strip.
  color.a *= smoothedge(0.0, edgePixels);
#endif
  if (picking.isActive > 0.5) {
    if (!picking_isColorValid(varyings.pickingColor)) {
      discard;
    }
    return vec4<f32>(varyings.pickingColor, 1.0);
  }
  if (picking.isHighlightActive > 0.5) {
    let highlightedObjectColor = picking_normalizeColor(picking.highlightedObjectColor);
    if (picking_isColorZero(abs(varyings.pickingColor - highlightedObjectColor))) {
      let highlightAlpha = picking.highlightColor.a;
      let blendedAlpha = highlightAlpha + color.a * (1.0 - highlightAlpha);
      if (blendedAlpha > 0.0) {
        let highlightRatio = highlightAlpha / blendedAlpha;
        color = vec4<f32>(
          mix(color.rgb, picking.highlightColor.rgb, highlightRatio),
          blendedAlpha
        );
      }
    }
  }
  return deckgl_premultiplied_alpha(color);
}
`,oR=`#version 300 es
#define SHADER_NAME arc-layer-vertex-shader
in vec4 instanceSourceColors;
in vec4 instanceTargetColors;
in vec3 instanceSourcePositions;
in vec3 instanceSourcePositions64Low;
in vec3 instanceTargetPositions;
in vec3 instanceTargetPositions64Low;
in float instanceWidths;
in float instanceHeights;
in float instanceTilts;
out vec4 vColor;
out vec2 uv;
out float isValid;
float paraboloid(float distance, float sourceZ, float targetZ, float ratio) {
float deltaZ = targetZ - sourceZ;
float dh = distance * instanceHeights;
if (dh == 0.0) {
return sourceZ + deltaZ * ratio;
}
float unitZ = deltaZ / dh;
float p2 = unitZ * unitZ + 1.0;
float dir = step(deltaZ, 0.0);
float z0 = mix(sourceZ, targetZ, dir);
float r = mix(ratio, 1.0 - ratio, dir);
return sqrt(r * (p2 - r)) * dh + z0;
}
vec2 getExtrusionOffset(vec2 line_clipspace, float offset_direction, float width) {
vec2 dir_screenspace = normalize(line_clipspace * project.viewportSize);
dir_screenspace = vec2(-dir_screenspace.y, dir_screenspace.x);
return dir_screenspace * offset_direction * width / 2.0;
}
float getSegmentRatio(float index) {
return smoothstep(0.0, 1.0, index / (arc.numSegments - 1.0));
}
vec3 interpolateFlat(vec3 source, vec3 target, float segmentRatio) {
float distance = length(source.xy - target.xy);
float z = paraboloid(distance, source.z, target.z, segmentRatio);
float tiltAngle = radians(instanceTilts);
vec2 tiltDirection = normalize(target.xy - source.xy);
vec2 tilt = vec2(-tiltDirection.y, tiltDirection.x) * z * sin(tiltAngle);
return vec3(
mix(source.xy, target.xy, segmentRatio) + tilt,
z * cos(tiltAngle)
);
}
float getAngularDist (vec2 source, vec2 target) {
vec2 sourceRadians = radians(source);
vec2 targetRadians = radians(target);
vec2 sin_half_delta = sin((sourceRadians - targetRadians) / 2.0);
vec2 shd_sq = sin_half_delta * sin_half_delta;
float a = shd_sq.y + cos(sourceRadians.y) * cos(targetRadians.y) * shd_sq.x;
return 2.0 * asin(sqrt(a));
}
vec3 interpolateGreatCircle(vec3 source, vec3 target, vec3 source3D, vec3 target3D, float angularDist, float t) {
vec2 lngLat;
if(abs(angularDist - PI) < 0.001) {
lngLat = (1.0 - t) * source.xy + t * target.xy;
} else {
float a = sin((1.0 - t) * angularDist);
float b = sin(t * angularDist);
vec3 p = source3D.yxz * a + target3D.yxz * b;
lngLat = degrees(vec2(atan(p.y, -p.x), atan(p.z, length(p.xy))));
}
float z = paraboloid(angularDist * EARTH_RADIUS, source.z, target.z, t);
return vec3(lngLat, z);
}
void main(void) {
geometry.worldPosition = instanceSourcePositions;
geometry.worldPositionAlt = instanceTargetPositions;
float segmentIndex = float(gl_VertexID / 2);
float segmentSide = mod(float(gl_VertexID), 2.) == 0. ? -1. : 1.;
float segmentRatio = getSegmentRatio(segmentIndex);
float prevSegmentRatio = getSegmentRatio(max(0.0, segmentIndex - 1.0));
float nextSegmentRatio = getSegmentRatio(min(arc.numSegments - 1.0, segmentIndex + 1.0));
float indexDir = mix(-1.0, 1.0, step(segmentIndex, 0.0));
isValid = 1.0;
uv = vec2(segmentRatio, segmentSide);
geometry.uv = uv;
geometry.pickingColor = picking_getPickingColorFromInstanceID();
vec4 curr;
vec4 next;
vec3 source;
vec3 target;
if ((arc.greatCircle || project.projectionMode == PROJECTION_MODE_GLOBE) && project.coordinateSystem == COORDINATE_SYSTEM_LNGLAT) {
source = project_globe_(vec3(instanceSourcePositions.xy, 0.0));
target = project_globe_(vec3(instanceTargetPositions.xy, 0.0));
float angularDist = getAngularDist(instanceSourcePositions.xy, instanceTargetPositions.xy);
vec3 prevPos = interpolateGreatCircle(instanceSourcePositions, instanceTargetPositions, source, target, angularDist, prevSegmentRatio);
vec3 currPos = interpolateGreatCircle(instanceSourcePositions, instanceTargetPositions, source, target, angularDist, segmentRatio);
vec3 nextPos = interpolateGreatCircle(instanceSourcePositions, instanceTargetPositions, source, target, angularDist, nextSegmentRatio);
if (abs(currPos.x - prevPos.x) > 180.0) {
indexDir = -1.0;
isValid = 0.0;
} else if (abs(currPos.x - nextPos.x) > 180.0) {
indexDir = 1.0;
isValid = 0.0;
}
nextPos = indexDir < 0.0 ? prevPos : nextPos;
nextSegmentRatio = indexDir < 0.0 ? prevSegmentRatio : nextSegmentRatio;
if (isValid == 0.0) {
nextPos.x += nextPos.x > 0.0 ? -360.0 : 360.0;
float t = ((currPos.x > 0.0 ? 180.0 : -180.0) - currPos.x) / (nextPos.x - currPos.x);
currPos = mix(currPos, nextPos, t);
segmentRatio = mix(segmentRatio, nextSegmentRatio, t);
}
vec3 currPos64Low = mix(instanceSourcePositions64Low, instanceTargetPositions64Low, segmentRatio);
vec3 nextPos64Low = mix(instanceSourcePositions64Low, instanceTargetPositions64Low, nextSegmentRatio);
curr = project_position_to_clipspace(currPos, currPos64Low, vec3(0.0), geometry.position);
next = project_position_to_clipspace(nextPos, nextPos64Low, vec3(0.0));
} else {
vec3 source_world = instanceSourcePositions;
vec3 target_world = instanceTargetPositions;
if (arc.useShortestPath) {
source_world.x = mod(source_world.x + 180., 360.0) - 180.;
target_world.x = mod(target_world.x + 180., 360.0) - 180.;
float deltaLng = target_world.x - source_world.x;
if (deltaLng > 180.) target_world.x -= 360.;
if (deltaLng < -180.) source_world.x -= 360.;
}
source = project_position(source_world, instanceSourcePositions64Low);
target = project_position(target_world, instanceTargetPositions64Low);
float antiMeridianX = 0.0;
if (arc.useShortestPath) {
if (project.projectionMode == PROJECTION_MODE_WEB_MERCATOR_AUTO_OFFSET) {
antiMeridianX = -(project.coordinateOrigin.x + 180.) / 360. * TILE_SIZE;
}
float thresholdRatio = (antiMeridianX - source.x) / (target.x - source.x);
if (prevSegmentRatio <= thresholdRatio && nextSegmentRatio > thresholdRatio) {
isValid = 0.0;
indexDir = sign(segmentRatio - thresholdRatio);
segmentRatio = thresholdRatio;
}
}
nextSegmentRatio = indexDir < 0.0 ? prevSegmentRatio : nextSegmentRatio;
vec3 currPos = interpolateFlat(source, target, segmentRatio);
vec3 nextPos = interpolateFlat(source, target, nextSegmentRatio);
if (arc.useShortestPath) {
if (nextPos.x < antiMeridianX) {
currPos.x += TILE_SIZE;
nextPos.x += TILE_SIZE;
}
}
curr = project_common_position_to_clipspace(vec4(currPos, 1.0));
next = project_common_position_to_clipspace(vec4(nextPos, 1.0));
geometry.position = vec4(currPos, 1.0);
}
float widthPixels = clamp(
project_size_to_pixel(instanceWidths * arc.widthScale, arc.widthUnits),
arc.widthMinPixels, arc.widthMaxPixels
);
vec3 offset = vec3(
getExtrusionOffset((next.xy - curr.xy) * indexDir, segmentSide, widthPixels),
0.0);
DECKGL_FILTER_SIZE(offset, geometry);
#ifdef ANTIALIASING
float halfWidthPixels = length(offset.xy);
if (halfWidthPixels > 0.0) {
float coverageScale = 1.0 + 0.5 / project.devicePixelRatio / halfWidthPixels;
offset.xy *= coverageScale;
uv.y *= coverageScale;
}
geometry.uv = uv;
#endif
DECKGL_FILTER_GL_POSITION(curr, geometry);
gl_Position = curr + vec4(project_pixel_size_to_clipspace(offset.xy), 0.0, 0.0);
vec4 color = mix(instanceSourceColors, instanceTargetColors, segmentRatio);
vColor = vec4(color.rgb, color.a * layer.opacity);
DECKGL_FILTER_COLOR(vColor, geometry);
}
`,aR=`#version 300 es
#define SHADER_NAME arc-layer-fragment-shader
precision highp float;
in vec4 vColor;
in vec2 uv;
in float isValid;
out vec4 fragColor;
void main(void) {
#ifdef ANTIALIASING
float edgeCoord = abs(uv.y);
float edgePixels = (1.0 - edgeCoord) / max(fwidth(edgeCoord), 1e-6);
#endif
if (isValid == 0.0) {
discard;
}
#ifdef ANTIALIASING
if (edgePixels <= -SMOOTH_EDGE_RADIUS) {
discard;
}
#endif
fragColor = vColor;
geometry.uv = uv;
#ifdef ANTIALIASING
fragColor.a *= smoothedge(0.0, edgePixels);
#endif
DECKGL_FILTER_COLOR(fragColor, geometry);
}
`,Dr=[0,0,0,255],cR={getSourcePosition:{type:"accessor",value:i=>i.sourcePosition},getTargetPosition:{type:"accessor",value:i=>i.targetPosition},getSourceColor:{type:"accessor",value:Dr},getTargetColor:{type:"accessor",value:Dr},getWidth:{type:"accessor",value:1},getHeight:{type:"accessor",value:1},getTilt:{type:"accessor",value:0},greatCircle:!1,numSegments:{type:"number",value:50,min:1},widthUnits:"pixels",widthScale:{type:"number",value:1,min:0},widthMinPixels:{type:"number",value:0,min:0},widthMaxPixels:{type:"number",value:Number.MAX_SAFE_INTEGER,min:0},antialiasing:!1};class tu extends et{getBounds(){return this.getAttributeManager()?.getBounds(["instanceSourcePositions","instanceTargetPositions"])}getShaders(){const{antialiasing:e}=this.props;return super.getShaders({vs:oR,fs:aR,source:rR,defines:e?{ANTIALIASING:1}:{},modules:[bi,_i,vi,sR]})}get wrapLongitude(){return!1}initializeState(){this.getAttributeManager().addInstanced({instanceSourcePositions:{size:3,type:"float64",fp64:this.use64bitPositions(),transition:!0,accessor:"getSourcePosition"},instanceTargetPositions:{size:3,type:"float64",fp64:this.use64bitPositions(),transition:!0,accessor:"getTargetPosition"},instanceSourceColors:{size:this.props.colorFormat.length,type:"unorm8",transition:!0,accessor:"getSourceColor",defaultValue:Dr},instanceTargetColors:{size:this.props.colorFormat.length,type:"unorm8",transition:!0,accessor:"getTargetColor",defaultValue:Dr},instanceWidths:{size:1,transition:!0,accessor:"getWidth",defaultValue:1},instanceHeights:{size:1,transition:!0,accessor:"getHeight",defaultValue:1},instanceTilts:{size:1,transition:!0,accessor:"getTilt",defaultValue:0}})}updateState(e){super.updateState(e);const{props:t,oldProps:n,changeFlags:s}=e;(s.extensionsChanged||t.antialiasing!==n.antialiasing)&&(this.state.model?.destroy(),this.state.model=this._getModel(),this.getAttributeManager().invalidateAll())}draw({uniforms:e}){const{widthUnits:t,widthScale:n,widthMinPixels:s,widthMaxPixels:r,greatCircle:o,wrapLongitude:a,numSegments:c}=this.props,l={numSegments:c,widthUnits:_t[t],widthScale:n,widthMinPixels:s,widthMaxPixels:r,greatCircle:o,useShortestPath:a},u=this.state.model;u.shaderInputs.setProps({arc:l}),u.setVertexCount(c*2),u.draw(this.context.renderPass)}_getModel(){return new ke(this.context.device,{...this.getShaders(),id:this.props.id,bufferLayout:this.getAttributeManager().getBufferLayouts(),topology:"triangle-strip",isInstanced:!0})}}tu.layerName="ArcLayer";tu.defaultProps=cR;const lR=new Uint32Array([0,2,1,0,3,2]),uR=new Float32Array([0,1,0,0,1,0,1,1]);function fR(i,e){if(!e)return dR(i);const t=Math.max(Math.abs(i[0][0]-i[3][0]),Math.abs(i[1][0]-i[2][0])),n=Math.max(Math.abs(i[1][1]-i[0][1]),Math.abs(i[2][1]-i[3][1])),s=Math.ceil(t/e)+1,r=Math.ceil(n/e)+1,o=(s-1)*(r-1)*6,a=new Uint32Array(o),c=new Float32Array(s*r*2),l=new Float64Array(s*r*3);let u=0,f=0;for(let d=0;d<s;d++){const h=d/(s-1);for(let g=0;g<r;g++){const p=g/(r-1),m=hR(i,h,p);l[u*3+0]=m[0],l[u*3+1]=m[1],l[u*3+2]=m[2]||0,c[u*2+0]=h,c[u*2+1]=1-p,d>0&&g>0&&(a[f++]=u-r,a[f++]=u-r-1,a[f++]=u-1,a[f++]=u-r,a[f++]=u-1,a[f++]=u),u++}}return{vertexCount:o,positions:l,indices:a,texCoords:c}}function dR(i){const e=new Float64Array(12);for(let t=0;t<i.length;t++)e[t*3+0]=i[t][0],e[t*3+1]=i[t][1],e[t*3+2]=i[t][2]||0;return{vertexCount:6,positions:e,indices:lR,texCoords:uR}}function hR(i,e,t){return Ut(Ut(i[0],i[1],t),Ut(i[3],i[2],t),e)}const gR=`
struct BitmapUniforms {
  bounds: vec4<f32>,
  coordinateConversion: f32,
  desaturate: f32,
  tintColor: vec3<f32>,
  transparentColor: vec4<f32>,
};

@group(0) @binding(auto) var<uniform> bitmap: BitmapUniforms;
@group(0) @binding(auto) var bitmapTexture: texture_2d<f32>;
@group(0) @binding(auto) var bitmapTextureSampler: sampler;
`,ch=`layout(std140) uniform bitmapUniforms {
  vec4 bounds;
  float coordinateConversion;
  float desaturate;
  vec3 tintColor;
  vec4 transparentColor;
} bitmap;
`,pR={name:"bitmap",source:gR,vs:ch,fs:ch,uniformTypes:{bounds:"vec4<f32>",coordinateConversion:"f32",desaturate:"f32",tintColor:"vec3<f32>",transparentColor:"vec4<f32>"}},mR=`struct Attributes {
  @location(0) positions: vec3<f32>,
  @location(1) positions64Low: vec3<f32>,
  @location(2) texCoords: vec2<f32>,
};

struct Varyings {
  @builtin(position) position: vec4<f32>,
  @location(0) vTexCoord: vec2<f32>,
  @location(1) vTexPos: vec2<f32>,
  @location(2) pickingColor: vec3<f32>,
  @location(3) pickingDepth: f32,
};

// from degrees to Web Mercator
fn lnglat_to_mercator(lnglat: vec2<f32>) -> vec2<f32> {
  let x = lnglat.x;
  let y = clamp(lnglat.y, -89.9, 89.9);
  return vec2<f32>(
    radians(x) + PI,
    PI + log(tan(PI * 0.25 + radians(y) * 0.5))
  ) * WORLD_SCALE;
}

// from Web Mercator to degrees
fn mercator_to_lnglat(xy: vec2<f32>) -> vec2<f32> {
  let position = xy / WORLD_SCALE;
  return degrees(vec2<f32>(
    position.x - PI,
    atan(exp(position.y - PI)) * 2.0 - PI * 0.5
  ));
}

fn color_desaturate(colorValue: vec3<f32>) -> vec3<f32> {
  let luminance = (colorValue.r + colorValue.g + colorValue.b) * 0.333333333;
  return mix(colorValue, vec3<f32>(luminance), bitmap.desaturate);
}

fn color_tint(colorValue: vec3<f32>) -> vec3<f32> {
  return colorValue * bitmap.tintColor;
}

fn apply_opacity(colorValue: vec3<f32>, alpha: f32) -> vec4<f32> {
  if (bitmap.transparentColor.a == 0.0) {
    return vec4<f32>(colorValue, alpha);
  }
  let blendedAlpha = alpha + bitmap.transparentColor.a * (1.0 - alpha);
  let highLightRatio = alpha / blendedAlpha;
  let blendedRGB = mix(bitmap.transparentColor.rgb, colorValue, highLightRatio);
  return vec4<f32>(blendedRGB, blendedAlpha);
}

fn getUV(position: vec2<f32>) -> vec2<f32> {
  return vec2<f32>(
    (position.x - bitmap.bounds[0]) / (bitmap.bounds[2] - bitmap.bounds[0]),
    (position.y - bitmap.bounds[3]) / (bitmap.bounds[1] - bitmap.bounds[3])
  );
}

// Pack the top 12 bits of two normalized floats into three 8-bit values.
fn packUVsIntoRGB(uv: vec2<f32>) -> vec3<f32> {
  let uv8bit = floor(uv * 256.0);
  let uvFraction = fract(uv * 256.0);
  let uvFraction4bit = floor(uvFraction * 16.0);
  let fractions = uvFraction4bit.x + uvFraction4bit.y * 16.0;
  return vec3<f32>(uv8bit, fractions) / 255.0;
}

@vertex
fn vertexMain(attributes: Attributes) -> Varyings {
  var output: Varyings;
  geometry.worldPosition = attributes.positions;
  geometry.uv = attributes.texCoords;
  geometry.pickingColor = picking_getPickingColorFromIndex(0u);

  let projectedPosition = project_position_to_clipspace_and_commonspace(
    attributes.positions,
    attributes.positions64Low,
    vec3<f32>(0.0)
  );
  geometry.position = projectedPosition.commonPosition;
  output.position = projectedPosition.clipPosition;
  output.vTexCoord = attributes.texCoords;
  output.vTexPos = vec2<f32>(0.0);
  output.pickingColor = geometry.pickingColor;
  output.pickingDepth = output.position.z / output.position.w;

  if (bitmap.coordinateConversion < -0.5) {
    output.vTexPos = geometry.position.xy + project.commonOrigin.xy;
  } else if (bitmap.coordinateConversion > 0.5) {
    output.vTexPos = geometry.worldPosition.xy;
  }

  return output;
}

@fragment
fn fragmentMain(input: Varyings) -> @location(0) vec4<f32> {
  var uv = input.vTexCoord;
  if (bitmap.coordinateConversion < -0.5) {
    uv = getUV(mercator_to_lnglat(input.vTexPos));
  } else if (bitmap.coordinateConversion > 0.5) {
    uv = getUV(lnglat_to_mercator(input.vTexPos));
  }

  let bitmapColor = textureSample(bitmapTexture, bitmapTextureSampler, uv);
  var fragColor = apply_opacity(
    color_tint(color_desaturate(bitmapColor.rgb)),
    bitmapColor.a * layer.opacity
  );

  geometry.uv = uv;

  if (picking.isActive > 0.5) {
    if (picking.isAttribute > 0.5) {
      return vec4<f32>(input.pickingDepth, 0.0, 0.0, 1.0);
    }
    return vec4<f32>(packUVsIntoRGB(uv), 1.0);
  }

  if (picking.isHighlightActive > 0.5) {
    let highlightedObjectColor = picking_normalizeColor(picking.highlightedObjectColor);
    if (picking_isColorZero(abs(input.pickingColor - highlightedObjectColor))) {
      let highLightAlpha = picking.highlightColor.a;
      let blendedAlpha = highLightAlpha + fragColor.a * (1.0 - highLightAlpha);
      if (blendedAlpha > 0.0) {
        let highLightRatio = highLightAlpha / blendedAlpha;
        fragColor = vec4<f32>(
          mix(fragColor.rgb, picking.highlightColor.rgb, highLightRatio),
          blendedAlpha
        );
      } else {
        fragColor = vec4<f32>(fragColor.rgb, 0.0);
      }
    }
  }

  return deckgl_premultiplied_alpha(fragColor);
}
`,yR=`#version 300 es
#define SHADER_NAME bitmap-layer-vertex-shader

in vec2 texCoords;
in vec3 positions;
in vec3 positions64Low;

out vec2 vTexCoord;
out vec2 vTexPos;

const vec3 pickingColor = vec3(1.0, 0.0, 0.0);

void main(void) {
  geometry.worldPosition = positions;
  geometry.uv = texCoords;
  geometry.pickingColor = pickingColor;

  gl_Position = project_position_to_clipspace(positions, positions64Low, vec3(0.0), geometry.position);
  DECKGL_FILTER_GL_POSITION(gl_Position, geometry);

  vTexCoord = texCoords;

  if (bitmap.coordinateConversion < -0.5) {
    vTexPos = geometry.position.xy + project.commonOrigin.xy;
  } else if (bitmap.coordinateConversion > 0.5) {
    vTexPos = geometry.worldPosition.xy;
  }

  vec4 color = vec4(0.0);
  DECKGL_FILTER_COLOR(color, geometry);
}
`,_R=`
vec3 packUVsIntoRGB(vec2 uv) {
  // Extract the top 8 bits. We want values to be truncated down so we can add a fraction
  vec2 uv8bit = floor(uv * 256.);

  // Calculate the normalized remainders of u and v parts that do not fit into 8 bits
  // Scale and clamp to 0-1 range
  vec2 uvFraction = fract(uv * 256.);
  vec2 uvFraction4bit = floor(uvFraction * 16.);

  // Remainder can be encoded in blue channel, encode as 4 bits for pixel coordinates
  float fractions = uvFraction4bit.x + uvFraction4bit.y * 16.;

  return vec3(uv8bit, fractions) / 255.;
}
`,bR=`#version 300 es
#define SHADER_NAME bitmap-layer-fragment-shader

#ifdef GL_ES
precision highp float;
#endif

uniform sampler2D bitmapTexture;

in vec2 vTexCoord;
in vec2 vTexPos;

out vec4 fragColor;

/* projection utils */
const float TILE_SIZE = 512.0;
const float PI = 3.1415926536;
const float WORLD_SCALE = TILE_SIZE / PI / 2.0;

// from degrees to Web Mercator
vec2 lnglat_to_mercator(vec2 lnglat) {
  float x = lnglat.x;
  float y = clamp(lnglat.y, -89.9, 89.9);
  return vec2(
    radians(x) + PI,
    PI + log(tan(PI * 0.25 + radians(y) * 0.5))
  ) * WORLD_SCALE;
}

// from Web Mercator to degrees
vec2 mercator_to_lnglat(vec2 xy) {
  xy /= WORLD_SCALE;
  return degrees(vec2(
    xy.x - PI,
    atan(exp(xy.y - PI)) * 2.0 - PI * 0.5
  ));
}
/* End projection utils */

// apply desaturation
vec3 color_desaturate(vec3 color) {
  float luminance = (color.r + color.g + color.b) * 0.333333333;
  return mix(color, vec3(luminance), bitmap.desaturate);
}

// apply tint
vec3 color_tint(vec3 color) {
  return color * bitmap.tintColor;
}

// blend with background color
vec4 apply_opacity(vec3 color, float alpha) {
  if (bitmap.transparentColor.a == 0.0) {
    return vec4(color, alpha);
  }
  float blendedAlpha = alpha + bitmap.transparentColor.a * (1.0 - alpha);
  float highLightRatio = alpha / blendedAlpha;
  vec3 blendedRGB = mix(bitmap.transparentColor.rgb, color, highLightRatio);
  return vec4(blendedRGB, blendedAlpha);
}

vec2 getUV(vec2 pos) {
  return vec2(
    (pos.x - bitmap.bounds[0]) / (bitmap.bounds[2] - bitmap.bounds[0]),
    (pos.y - bitmap.bounds[3]) / (bitmap.bounds[1] - bitmap.bounds[3])
  );
}

${_R}

void main(void) {
  vec2 uv = vTexCoord;
  if (bitmap.coordinateConversion < -0.5) {
    vec2 lnglat = mercator_to_lnglat(vTexPos);
    uv = getUV(lnglat);
  } else if (bitmap.coordinateConversion > 0.5) {
    vec2 commonPos = lnglat_to_mercator(vTexPos);
    uv = getUV(commonPos);
  }
  vec4 bitmapColor = texture(bitmapTexture, uv);

  fragColor = apply_opacity(color_tint(color_desaturate(bitmapColor.rgb)), bitmapColor.a * layer.opacity);

  geometry.uv = uv;
  DECKGL_FILTER_COLOR(fragColor, geometry);

  if (bool(picking.isActive) && !bool(picking.isAttribute)) {
    // Since instance information is not used, we can use picking color for pixel index
    fragColor.rgb = packUVsIntoRGB(uv);
  }
}
`,vR={image:{type:"image",value:null,async:!0},bounds:{type:"array",value:[1,0,0,1],compare:!0},_imageCoordinateSystem:"default",desaturate:{type:"number",min:0,max:1,value:0},transparentColor:{type:"color",value:[0,0,0,0]},tintColor:{type:"color",value:[255,255,255]},textureParameters:{type:"object",ignore:!0,value:null}};class iu extends et{getShaders(){return super.getShaders({vs:yR,fs:bR,source:mR,modules:[_i,bi,vi,pR]})}initializeState(){const e=this.getAttributeManager(),t=!0;e.add({indices:{size:1,isIndexed:!0,update:n=>n.value=this.state.mesh.indices,noAlloc:t},positions:{size:3,type:"float64",fp64:this.use64bitPositions(),update:n=>n.value=this.state.mesh.positions,noAlloc:t},texCoords:{size:2,update:n=>n.value=this.state.mesh.texCoords,noAlloc:t}})}updateState({props:e,oldProps:t,changeFlags:n}){const s=this.getAttributeManager();if(n.extensionsChanged&&(this.state.model?.destroy(),this.state.model=this._getModel(),s.invalidateAll()),e.bounds!==t.bounds){const r=this.state.mesh,o=this._createMesh();this.state.model.setVertexCount(o.vertexCount);for(const a in o)r&&r[a]!==o[a]&&s.invalidate(a);this.setState({mesh:o,...this._getCoordinateUniforms()})}else e._imageCoordinateSystem!==t._imageCoordinateSystem&&this.setState(this._getCoordinateUniforms())}getPickingInfo(e){const{image:t}=this.props,n=e.info;if(!n.color||!t)return n.bitmap=null,n;const{width:s,height:r}=t;n.index=0;const o=xR(n.color);return n.bitmap={size:{width:s,height:r},uv:o,pixel:[Math.floor(o[0]*s),Math.floor(o[1]*r)]},n}disablePickingIndex(){this.setState({disablePicking:!0})}restorePickingColors(){this.setState({disablePicking:!1})}_updateAutoHighlight(e){super._updateAutoHighlight({...e,color:this.encodePickingColor(0)})}_createMesh(){const{bounds:e}=this.props;let t=e;return lh(e)&&(t=[[e[0],e[1]],[e[0],e[3]],[e[2],e[3]],[e[2],e[1]]]),fR(t,this.context.viewport.resolution)}_getModel(){const e=this.context.device.type==="webgpu"?this.getAttributeManager().getBufferLayouts({isInstanced:!1}).filter(t=>t.name!=="indices"):this.getAttributeManager().getBufferLayouts();return new ke(this.context.device,{...this.getShaders(),id:this.props.id,bufferLayout:e,topology:"triangle-list",isInstanced:!1})}draw(e){const{shaderModuleProps:t}=e,{model:n,coordinateConversion:s,bounds:r,disablePicking:o}=this.state,{image:a,desaturate:c,transparentColor:l,tintColor:u}=this.props;if(!(t.picking.isActive&&o)&&a&&n){const f={bitmapTexture:a,bounds:r,coordinateConversion:s,desaturate:c,tintColor:u.slice(0,3).map(d=>d/255),transparentColor:l.map(d=>d/255)};n.shaderInputs.setProps({bitmap:f}),n.draw(this.context.renderPass)}}_getCoordinateUniforms(){let{_imageCoordinateSystem:e}=this.props;if(e!=="default"){const{bounds:t}=this.props;if(!lh(t))throw new Error("_imageCoordinateSystem only supports rectangular bounds");const n=this.context.viewport.resolution?"lnglat":"cartesian";if(e=e==="lnglat"?"lnglat":"cartesian",e==="lnglat"&&n==="cartesian")return{coordinateConversion:-1,bounds:t};if(e==="cartesian"&&n==="lnglat"){const s=bt([t[0],t[1]]),r=bt([t[2],t[3]]);return{coordinateConversion:1,bounds:[s[0],s[1],r[0],r[1]]}}}return{coordinateConversion:0,bounds:[0,0,0,0]}}}iu.layerName="BitmapLayer";iu.defaultProps=vR;function xR(i){const[e,t,n]=i,s=(n&240)/256,r=(n&15)/16;return[(e+r)/256,(t+s)/256]}function lh(i){return Number.isFinite(i[0])}const uh=`layout(std140) uniform iconUniforms {
  float sizeScale;
  vec2 iconsTextureDim;
  float sizeBasis;
  float sizeMinPixels;
  float sizeMaxPixels;
  bool billboard;
  highp int sizeUnits;
  float alphaCutoff;
} icon;
`,wR={name:"icon",vs:uh,fs:uh,uniformTypes:{sizeScale:"f32",iconsTextureDim:"vec2<f32>",sizeBasis:"f32",sizeMinPixels:"f32",sizeMaxPixels:"f32",billboard:"f32",sizeUnits:"i32",alphaCutoff:"f32"}},PR=`#version 300 es
#define SHADER_NAME icon-layer-vertex-shader
in vec2 positions;
in vec3 instancePositions;
in vec3 instancePositions64Low;
in float instanceSizes;
in float instanceAngles;
in vec4 instanceColors;
#ifdef USE_ROW_INDEXES
in float rowIndexes;
#endif
in vec4 instanceIconFrames;
in float instanceColorModes;
in vec2 instanceOffsets;
in vec2 instancePixelOffset;
out float vColorMode;
out vec4 vColor;
out vec2 vTextureCoords;
out vec2 uv;
vec2 rotate_by_angle(vec2 vertex, float angle) {
float angle_radian = angle * PI / 180.0;
float cos_angle = cos(angle_radian);
float sin_angle = sin(angle_radian);
mat2 rotationMatrix = mat2(cos_angle, -sin_angle, sin_angle, cos_angle);
return rotationMatrix * vertex;
}
void main(void) {
geometry.worldPosition = instancePositions;
geometry.uv = positions;
#ifdef USE_ROW_INDEXES
geometry.pickingColor = picking_getPickingColorFromIndex(rowIndexes);
#else
geometry.pickingColor = picking_getPickingColorFromInstanceID();
#endif
uv = positions;
vec2 iconSize = instanceIconFrames.zw;
float sizePixels = clamp(
project_size_to_pixel(instanceSizes * icon.sizeScale, icon.sizeUnits),
icon.sizeMinPixels, icon.sizeMaxPixels
);
float iconConstraint = icon.sizeBasis == 0.0 ? iconSize.x : iconSize.y;
float instanceScale = iconConstraint == 0.0 ? 0.0 : sizePixels / iconConstraint;
vec2 pixelOffset = positions / 2.0 * iconSize + instanceOffsets;
pixelOffset = rotate_by_angle(pixelOffset, instanceAngles) * instanceScale;
pixelOffset += instancePixelOffset;
pixelOffset.y *= -1.0;
if (icon.billboard)  {
gl_Position = project_position_to_clipspace(instancePositions, instancePositions64Low, vec3(0.0), geometry.position);
DECKGL_FILTER_GL_POSITION(gl_Position, geometry);
vec3 offset = vec3(pixelOffset, 0.0);
DECKGL_FILTER_SIZE(offset, geometry);
gl_Position.xy += project_pixel_size_to_clipspace(offset.xy);
} else {
vec3 offset_common = vec3(project_pixel_size(pixelOffset), 0.0);
DECKGL_FILTER_SIZE(offset_common, geometry);
gl_Position = project_position_to_clipspace(instancePositions, instancePositions64Low, offset_common, geometry.position);
DECKGL_FILTER_GL_POSITION(gl_Position, geometry);
}
vTextureCoords = mix(
instanceIconFrames.xy,
instanceIconFrames.xy + iconSize,
(positions.xy + 1.0) / 2.0
) / icon.iconsTextureDim;
vColor = instanceColors;
DECKGL_FILTER_COLOR(vColor, geometry);
vColorMode = instanceColorModes;
}
`,SR=`#version 300 es
#define SHADER_NAME icon-layer-fragment-shader
precision highp float;
uniform sampler2D iconsTexture;
in float vColorMode;
in vec4 vColor;
in vec2 vTextureCoords;
in vec2 uv;
out vec4 fragColor;
void main(void) {
geometry.uv = uv;
vec4 texColor = texture(iconsTexture, vTextureCoords);
vec3 color = mix(texColor.rgb, vColor.rgb, vColorMode);
float a = texColor.a * layer.opacity * vColor.a;
if (a < icon.alphaCutoff) {
discard;
}
fragColor = vec4(color, a);
DECKGL_FILTER_COLOR(fragColor, geometry);
}
`,ER=`struct IconUniforms {
  sizeScale: f32,
  iconsTextureDim: vec2<f32>,
  sizeBasis: f32,
  sizeMinPixels: f32,
  sizeMaxPixels: f32,
  billboard: i32,
  sizeUnits: i32,
  alphaCutoff: f32
};

@group(0) @binding(auto) var<uniform> icon: IconUniforms;
@group(0) @binding(auto) var iconsTexture : texture_2d<f32>;
@group(0) @binding(auto) var iconsTextureSampler : sampler;

fn rotate_by_angle(vertex: vec2<f32>, angle_deg: f32) -> vec2<f32> {
  let angle_radian = angle_deg * PI / 180.0;
  let c = cos(angle_radian);
  let s = sin(angle_radian);
  let rotation = mat2x2<f32>(vec2<f32>(c, s), vec2<f32>(-s, c));
  return rotation * vertex;
}

struct Attributes {
  @builtin(instance_index) instanceIndex : u32,
  @location(0) positions: vec2<f32>,

  @location(1) instancePositions: vec3<f32>,
  @location(2) instancePositions64Low: vec3<f32>,
  @location(3) instanceSizes: f32,
  @location(4) instanceAngles: f32,
  @location(5) instanceColors: vec4<f32>,
  @location(6) instanceIconFrames: vec4<f32>,
  @location(7) instanceColorModes: f32,
  @location(8) instanceOffsets: vec2<f32>,
  @location(9) instancePixelOffset: vec2<f32>,
  PICKING_COLOR_ATTRIBUTE
};

struct Varyings {
  @builtin(position) position: vec4<f32>,

  @location(0) vColorMode: f32,
  @location(1) vColor: vec4<f32>,
  @location(2) vTextureCoords: vec2<f32>,
  @location(3) uv: vec2<f32>,
  @location(4) pickingColor: vec3<f32>,
};

@vertex
fn vertexMain(inp: Attributes) -> Varyings {
  // write geometry fields used by filters + FS
  geometry.worldPosition = inp.instancePositions;
  geometry.uv = inp.positions;
  geometry.pickingColor = PICKING_COLOR_VALUE;

  var outp: Varyings;
  outp.uv = inp.positions;

  let iconSize = inp.instanceIconFrames.zw;

  // convert size in meters to pixels, then clamp
  let sizePixels = clamp(
    project_unit_size_to_pixel(inp.instanceSizes * icon.sizeScale, icon.sizeUnits),
    icon.sizeMinPixels, icon.sizeMaxPixels
  );

  // scale icon height to match instanceSize
  let iconConstraint = select(iconSize.y, iconSize.x, icon.sizeBasis == 0.0);
  let instanceScale = select(sizePixels / iconConstraint, 0.0, iconConstraint == 0.0);

  // scale and rotate vertex in "pixel" units; then add per-instance pixel offset
  var pixelOffset = inp.positions / 2.0 * iconSize + inp.instanceOffsets;
  pixelOffset = rotate_by_angle(pixelOffset, inp.instanceAngles) * instanceScale;
  pixelOffset = pixelOffset + inp.instancePixelOffset;
  pixelOffset.y = pixelOffset.y * -1.0;

  if (icon.billboard != 0) {
    var pos = project_position_to_clipspace(inp.instancePositions, inp.instancePositions64Low, vec3<f32>(0.0)); // TODO, &geometry.position);
    // DECKGL_FILTER_GL_POSITION(pos, geometry);

    var offset = vec3<f32>(pixelOffset, 0.0);
    // DECKGL_FILTER_SIZE(offset, geometry);
    let clipOffset = project_pixel_size_to_clipspace(offset.xy);
    pos = vec4<f32>(pos.x + clipOffset.x, pos.y + clipOffset.y, pos.z, pos.w);
    outp.position = pos;
  } else {
    var offset_common = vec3<f32>(project_pixel_size_vec2(pixelOffset), 0.0);
    // DECKGL_FILTER_SIZE(offset_common, geometry);
    var pos = project_position_to_clipspace(inp.instancePositions, inp.instancePositions64Low, offset_common); // TODO, &geometry.position);
    // DECKGL_FILTER_GL_POSITION(pos, geometry);
    outp.position = pos;
  }

  let uvMix = (inp.positions.xy + vec2<f32>(1.0, 1.0)) * 0.5;
  outp.vTextureCoords = mix(inp.instanceIconFrames.xy, inp.instanceIconFrames.xy + iconSize, uvMix) / icon.iconsTextureDim;

  outp.vColor = inp.instanceColors;
  // DECKGL_FILTER_COLOR(outp.vColor, geometry);

  outp.vColorMode = inp.instanceColorModes;
  outp.pickingColor = geometry.pickingColor;

  return outp;
}

@fragment
fn fragmentMain(inp: Varyings) -> @location(0) vec4<f32> {
  // expose to deck.gl filter hooks
  geometry.uv = inp.uv;

  let texColor = textureSample(iconsTexture, iconsTextureSampler, inp.vTextureCoords);

  // if colorMode == 0, use pixel color from the texture
  // if colorMode == 1 (or picking), use texture as transparency mask
  let rgb = mix(texColor.rgb, inp.vColor.rgb, inp.vColorMode);
  let a = texColor.a * layer.opacity * inp.vColor.a;

  if (a < icon.alphaCutoff) {
    discard;
  }

  if (picking.isActive > 0.5) {
    if (!picking_isColorValid(inp.pickingColor)) {
      discard;
    }
    return vec4<f32>(inp.pickingColor, 1.0);
  }

  var fragColor = deckgl_premultiplied_alpha(vec4<f32>(rgb, a));

  if (picking.isHighlightActive > 0.5) {
    let highlightedObjectColor = picking_normalizeColor(picking.highlightedObjectColor);
    if (picking_isColorZero(abs(inp.pickingColor - highlightedObjectColor))) {
      let highLightAlpha = picking.highlightColor.a;
      let blendedAlpha = highLightAlpha + fragColor.a * (1.0 - highLightAlpha);
      if (blendedAlpha > 0.0) {
        let highLightRatio = highLightAlpha / blendedAlpha;
        fragColor = vec4<f32>(
          mix(fragColor.rgb, picking.highlightColor.rgb, highLightRatio),
          blendedAlpha
        );
      } else {
        fragColor = vec4<f32>(fragColor.rgb, 0.0);
      }
    }
  }

  return fragColor;
}
`;function CR(i){return ER.replace("PICKING_COLOR_ATTRIBUTE",i?"@location(10) rowIndexes: u32,":"").replace("PICKING_COLOR_VALUE",i?"picking_getPickingColorFromIndex(inp.rowIndexes)":"picking_getPickingColorFromIndex(inp.instanceIndex)")}const LR=1024,TR=4,fh=()=>{},dh={minFilter:"linear",mipmapFilter:"linear",magFilter:"linear",addressModeU:"clamp-to-edge",addressModeV:"clamp-to-edge"},AR={x:0,y:0,width:0,height:0};function MR(i){return Math.pow(2,Math.ceil(Math.log2(i)))}function IR(i,e,t,n){const s=Math.min(t/e.width,n/e.height),r=Math.floor(e.width*s),o=Math.floor(e.height*s);return s===1?{image:e,width:r,height:o}:(i.canvas.height=o,i.canvas.width=r,i.clearRect(0,0,r,o),i.drawImage(e,0,0,e.width,e.height,0,0,r,o),{image:i.canvas,width:r,height:o})}function Zn(i){return i&&(i.id||i.url)}function Xm(i){const{device:e}=i;e.type==="webgl"?i.generateMipmapsWebGL():e.type==="webgpu"&&e.generateMipmapsWebGPU(i)}function RR(i,e,t,n){const{width:s,height:r,device:o}=i,a=o.createTexture({format:"rgba8unorm",width:e,height:t,sampler:n,mipLevels:o.getMipLevelCount(e,t)}),c=o.createCommandEncoder();c.copyTextureToTexture({sourceTexture:i,destinationTexture:a,width:s,height:r});const l=c.finish();return o.submit(l),Xm(a),i.destroy(),a}function hh(i,e,t){for(let n=0;n<e.length;n++){const{icon:s,xOffset:r}=e[n],o=Zn(s);i[o]={...s,x:r,y:t}}}function OR({icons:i,buffer:e,mapping:t={},xOffset:n=0,yOffset:s=0,rowHeight:r=0,canvasWidth:o}){let a=[];for(let c=0;c<i.length;c++){const l=i[c],u=Zn(l);if(!t[u]){const{height:f,width:d}=l;n+d+e>o&&(hh(t,a,s),n=0,s=r+s+e,r=0,a=[]),a.push({icon:l,xOffset:n}),n=n+d+e,r=Math.max(r,f)}}return a.length>0&&hh(t,a,s),{mapping:t,rowHeight:r,xOffset:n,yOffset:s,canvasWidth:o,canvasHeight:MR(r+s+e)}}function kR(i,e,t){if(!i||!e)return null;t=t||{};const n={},{iterable:s,objectInfo:r}=os(i);for(const o of s){r.index++;const a=e(o,r),c=Zn(a);if(!a)throw new Error("Icon is missing.");if(!a.url)throw new Error("Icon url is missing.");!n[c]&&(!t[c]||a.url!==t[c].url)&&(n[c]={...a,source:o,sourceIndex:r.index})}return n}class BR{constructor(e,{onUpdate:t=fh,onError:n=fh}){this._loadOptions=null,this._texture=null,this._externalTexture=null,this._mapping={},this._samplerParameters=null,this._pendingCount=0,this._autoPacking=!1,this._xOffset=0,this._yOffset=0,this._rowHeight=0,this._buffer=TR,this._canvasWidth=LR,this._canvasHeight=0,this._canvas=null,this.device=e,this.onUpdate=t,this.onError=n}finalize(){this._texture?.delete()}getTexture(){return this._texture||this._externalTexture}getIconMapping(e){const t=this._autoPacking?Zn(e):e;return this._mapping[t]||AR}setProps({loadOptions:e,autoPacking:t,iconAtlas:n,iconMapping:s,textureParameters:r}){e&&(this._loadOptions=e),t!==void 0&&(this._autoPacking=t),s&&(this._mapping=s),n&&(this._texture?.delete(),this._texture=null,this._externalTexture=n),r&&(this._samplerParameters=r)}get isLoaded(){return this._pendingCount===0}packIcons(e,t){if(!this._autoPacking||typeof document>"u")return;const n=Object.values(kR(e,t,this._mapping)||{});if(n.length>0){const{mapping:s,xOffset:r,yOffset:o,rowHeight:a,canvasHeight:c}=OR({icons:n,buffer:this._buffer,canvasWidth:this._canvasWidth,mapping:this._mapping,rowHeight:this._rowHeight,xOffset:this._xOffset,yOffset:this._yOffset});this._rowHeight=a,this._mapping=s,this._xOffset=r,this._yOffset=o,this._canvasHeight=c,this._texture||(this._texture=this.device.createTexture({format:"rgba8unorm",data:null,width:this._canvasWidth,height:this._canvasHeight,sampler:this._samplerParameters||dh,mipLevels:this.device.getMipLevelCount(this._canvasWidth,this._canvasHeight)})),this._texture.height!==this._canvasHeight&&(this._texture=RR(this._texture,this._canvasWidth,this._canvasHeight,this._samplerParameters||dh)),this.onUpdate(!0),this._canvas=this._canvas||document.createElement("canvas"),this._loadIcons(n)}}_loadIcons(e){const t=this._canvas.getContext("2d",{willReadFrequently:!0});for(const n of e)this._pendingCount++,gr(n.url,this._loadOptions).then(s=>{const r=Zn(n),o=this._mapping[r],{x:a,y:c,width:l,height:u}=o,{image:f,width:d,height:h}=IR(t,s,l,u),g=a+(l-d)/2,p=c+(u-h)/2;this._texture?.copyExternalImage({image:f,x:g,y:p,width:d,height:h}),o.x=g,o.y=p,o.width=d,o.height=h,this._texture&&Xm(this._texture),this.onUpdate(d!==l||h!==u)}).catch(s=>{this.onError({url:n.url,source:n.source,sourceIndex:n.sourceIndex,loadOptions:this._loadOptions,error:s})}).finally(()=>{this._pendingCount--})}}const Km=[0,0,0,255],DR={iconAtlas:{type:"image",value:null,async:!0},iconMapping:{type:"object",value:{},async:!0},sizeScale:{type:"number",value:1,min:0},billboard:!0,sizeUnits:"pixels",sizeBasis:"height",sizeMinPixels:{type:"number",min:0,value:0},sizeMaxPixels:{type:"number",min:0,value:Number.MAX_SAFE_INTEGER},alphaCutoff:{type:"number",value:.05,min:0,max:1},getPosition:{type:"accessor",value:i=>i.position},getIcon:{type:"accessor",value:i=>i.icon},getColor:{type:"accessor",value:Km},getSize:{type:"accessor",value:1},getAngle:{type:"accessor",value:0},getPixelOffset:{type:"accessor",value:[0,0]},onIconError:{type:"function",value:null,optional:!0},textureParameters:{type:"object",ignore:!0,value:null}};class Qi extends et{getShaders(){const e=!!this.props.data?.attributes?.rowIndexes;return super.getShaders({vs:PR,fs:SR,source:CR(e),defines:e?{USE_ROW_INDEXES:!0}:{},modules:[bi,_i,vi,wR]})}initializeState(){this.state={iconManager:new BR(this.context.device,{onUpdate:this._onUpdate.bind(this),onError:this._onError.bind(this)})},this.getAttributeManager().addInstanced({instancePositions:{size:3,type:"float64",fp64:this.use64bitPositions(),transition:!0,accessor:"getPosition"},instanceSizes:{size:1,transition:!0,bufferGroup:"icon-instance-data",accessor:"getSize",defaultValue:1},instanceIconDefs:{size:7,bufferGroup:"icon-instance-data",accessor:"getIcon",transform:this.getInstanceIconDef,shaderAttributes:{instanceOffsets:{size:2,elementOffset:0},instanceIconFrames:{size:4,elementOffset:2},instanceColorModes:{size:1,elementOffset:6}}},instanceColors:{size:this.props.colorFormat.length,type:"unorm8",transition:!0,bufferGroup:"icon-instance-data",accessor:"getColor",defaultValue:Km},instanceAngles:{size:1,transition:!0,bufferGroup:"icon-instance-data",accessor:"getAngle"},instancePixelOffset:{size:2,transition:!0,bufferGroup:"icon-instance-data",accessor:"getPixelOffset"},...this.props.data?.attributes?.rowIndexes?{rowIndexes:{size:1,type:"uint32",noAlloc:!0}}:{}})}updateState(e){super.updateState(e);const{props:t,oldProps:n,changeFlags:s}=e,r=this.getAttributeManager(),{iconAtlas:o,iconMapping:a,data:c,getIcon:l,textureParameters:u}=t,{iconManager:f}=this.state;if(typeof o=="string")return;const d=o||this.internalState.isAsyncPropLoading("iconAtlas");f.setProps({loadOptions:t.loadOptions,autoPacking:!d,iconAtlas:o,iconMapping:d?a:null,textureParameters:u}),d?n.iconMapping!==t.iconMapping&&r.invalidate("getIcon"):(s.dataChanged||s.updateTriggersChanged&&(s.updateTriggersChanged.all||s.updateTriggersChanged.getIcon))&&f.packIcons(c,l),s.extensionsChanged&&(this.state.model?.destroy(),this.state.model=this._getModel(),r.invalidateAll())}get isLoaded(){return super.isLoaded&&this.state.iconManager.isLoaded}finalizeState(e){super.finalizeState(e),this.state.iconManager.finalize()}draw({uniforms:e}){this._drawModel(this.state.model)}_drawModel(e){const{sizeScale:t,sizeBasis:n,sizeMinPixels:s,sizeMaxPixels:r,sizeUnits:o,billboard:a,alphaCutoff:c}=this.props,{iconManager:l}=this.state,u=l.getTexture();if(u){const f={iconsTexture:u,iconsTextureDim:[u.width,u.height],sizeUnits:_t[o],sizeScale:t,sizeBasis:n==="height"?1:0,sizeMinPixels:s,sizeMaxPixels:r,billboard:a,alphaCutoff:c};e.shaderInputs.setProps({icon:f}),e.draw(this.context.renderPass)}}_getModel(e=this.props.id){const t=[-1,-1,1,-1,-1,1,1,1];return new ke(this.context.device,{...this.getShaders(),id:e,bufferLayout:this.getAttributeManager().getBufferLayouts(),geometry:new ui({topology:"triangle-strip",attributes:{positions:{size:2,value:new Float32Array(t)}}}),isInstanced:!0})}_onUpdate(e){e?(this.getAttributeManager()?.invalidate("getIcon"),this.setNeedsUpdate()):this.setNeedsRedraw()}_onError(e){const t=this.getCurrentLayer()?.props.onIconError;t?t(e):K.error(e.error.message)()}getInstanceIconDef(e){const{x:t,y:n,width:s,height:r,mask:o,anchorX:a=s/2,anchorY:c=r/2}=this.state.iconManager.getIconMapping(e);return[s/2-a,r/2-c,t,n,s,r,o?1:0]}}Qi.defaultProps=DR;Qi.layerName="IconLayer";const gh=`layout(std140) uniform scatterplotUniforms {
  float radiusScale;
  float radiusMinPixels;
  float radiusMaxPixels;
  float lineWidthScale;
  float lineWidthMinPixels;
  float lineWidthMaxPixels;
  float stroked;
  float filled;
  bool antialiasing;
  bool billboard;
  highp int radiusUnits;
  highp int lineWidthUnits;
} scatterplot;
`,FR={name:"scatterplot",vs:gh,fs:gh,source:"",uniformTypes:{radiusScale:"f32",radiusMinPixels:"f32",radiusMaxPixels:"f32",lineWidthScale:"f32",lineWidthMinPixels:"f32",lineWidthMaxPixels:"f32",stroked:"f32",filled:"f32",antialiasing:"f32",billboard:"f32",radiusUnits:"i32",lineWidthUnits:"i32"}},zR=`#version 300 es
#define SHADER_NAME scatterplot-layer-vertex-shader
in vec3 positions;
in vec3 instancePositions;
in vec3 instancePositions64Low;
in float instanceRadius;
in float instanceLineWidths;
in vec4 instanceFillColors;
in vec4 instanceLineColors;
#ifdef USE_ROW_INDEXES
in float rowIndexes;
#endif
in vec2 instancePixelOffset;
out vec4 vFillColor;
out vec4 vLineColor;
out vec2 unitPosition;
out float innerUnitRadius;
out float outerRadiusPixels;
void main(void) {
geometry.worldPosition = instancePositions;
outerRadiusPixels = clamp(
project_size_to_pixel(scatterplot.radiusScale * instanceRadius, scatterplot.radiusUnits),
scatterplot.radiusMinPixels, scatterplot.radiusMaxPixels
);
float lineWidthPixels = clamp(
project_size_to_pixel(scatterplot.lineWidthScale * instanceLineWidths, scatterplot.lineWidthUnits),
scatterplot.lineWidthMinPixels, scatterplot.lineWidthMaxPixels
);
outerRadiusPixels += scatterplot.stroked * lineWidthPixels / 2.0;
float edgePadding = scatterplot.antialiasing ? (outerRadiusPixels + SMOOTH_EDGE_RADIUS) / outerRadiusPixels : 1.0;
unitPosition = edgePadding * positions.xy;
geometry.uv = unitPosition;
#ifdef USE_ROW_INDEXES
geometry.pickingColor = picking_getPickingColorFromIndex(rowIndexes);
#else
geometry.pickingColor = picking_getPickingColorFromInstanceID();
#endif
innerUnitRadius = 1.0 - scatterplot.stroked * lineWidthPixels / outerRadiusPixels;
if (scatterplot.billboard) {
gl_Position = project_position_to_clipspace(instancePositions, instancePositions64Low, vec3(0.0), geometry.position);
DECKGL_FILTER_GL_POSITION(gl_Position, geometry);
vec3 offset = edgePadding * positions * outerRadiusPixels;
offset.xy += instancePixelOffset;
DECKGL_FILTER_SIZE(offset, geometry);
gl_Position.xy += project_pixel_size_to_clipspace(offset.xy);
} else {
vec3 offset = edgePadding * positions * project_pixel_size(outerRadiusPixels);
offset.xy += project_pixel_size(instancePixelOffset);
DECKGL_FILTER_SIZE(offset, geometry);
gl_Position = project_position_to_clipspace(instancePositions, instancePositions64Low, offset, geometry.position);
DECKGL_FILTER_GL_POSITION(gl_Position, geometry);
}
vFillColor = vec4(instanceFillColors.rgb, instanceFillColors.a * layer.opacity);
DECKGL_FILTER_COLOR(vFillColor, geometry);
vLineColor = vec4(instanceLineColors.rgb, instanceLineColors.a * layer.opacity);
DECKGL_FILTER_COLOR(vLineColor, geometry);
}
`,NR=`#version 300 es
#define SHADER_NAME scatterplot-layer-fragment-shader
precision highp float;
in vec4 vFillColor;
in vec4 vLineColor;
in vec2 unitPosition;
in float innerUnitRadius;
in float outerRadiusPixels;
out vec4 fragColor;
void main(void) {
geometry.uv = unitPosition;
float distToCenter = length(unitPosition) * outerRadiusPixels;
float inCircle = scatterplot.antialiasing ?
smoothedge(distToCenter, outerRadiusPixels) :
step(distToCenter, outerRadiusPixels);
if (inCircle == 0.0) {
discard;
}
if (scatterplot.stroked > 0.5) {
float isLine = scatterplot.antialiasing ?
smoothedge(innerUnitRadius * outerRadiusPixels, distToCenter) :
step(innerUnitRadius * outerRadiusPixels, distToCenter);
if (scatterplot.filled > 0.5) {
fragColor = mix(vFillColor, vLineColor, isLine);
} else {
if (isLine == 0.0) {
discard;
}
fragColor = vec4(vLineColor.rgb, vLineColor.a * isLine);
}
} else if (scatterplot.filled < 0.5) {
discard;
} else {
fragColor = vFillColor;
}
fragColor.a *= inCircle;
DECKGL_FILTER_COLOR(fragColor, geometry);
}
`,UR=`// Main shaders

struct ScatterplotUniforms {
  radiusScale: f32,
  radiusMinPixels: f32,
  radiusMaxPixels: f32,
  lineWidthScale: f32,
  lineWidthMinPixels: f32,
  lineWidthMaxPixels: f32,
  stroked: f32,
  filled: i32,
  antialiasing: i32,
  billboard: i32,
  radiusUnits: i32,
  lineWidthUnits: i32,
};

@group(0) @binding(0) var<uniform> scatterplot: ScatterplotUniforms;

struct Attributes {
  @builtin(instance_index) instanceIndex : u32,
  @builtin(vertex_index) vertexIndex : u32,
  @location(0) positions: vec3<f32>,
  @location(1) instancePositions: vec3<f32>,
  @location(2) instancePositions64Low: vec3<f32>,
  @location(3) instanceRadius: f32,
  @location(4) instanceLineWidths: f32,
  @location(5) instanceFillColors: vec4<f32>,
  @location(6) instanceLineColors: vec4<f32>,
  @location(7) instancePixelOffset: vec2<f32>,
  PICKING_COLOR_ATTRIBUTE
};

struct Varyings {
  @builtin(position) position: vec4<f32>,
  @location(0) vFillColor: vec4<f32>,
  @location(1) vLineColor: vec4<f32>,
  @location(2) unitPosition: vec2<f32>,
  @location(3) innerUnitRadius: f32,
  @location(4) outerRadiusPixels: f32,
  @location(5) pickingColor: vec3<f32>,
  @location(6) clipCoordinates: vec2<f32>,
};

@vertex
fn vertexMain(attributes: Attributes) -> Varyings {
  var varyings: Varyings;

  // Draw an inline geometry constant array clip space triangle to verify that rendering works.
  // var positions = array<vec2<f32>, 3>(vec2(0.0, 0.5), vec2(-0.5, -0.5), vec2(0.5, -0.5));
  // if (attributes.instanceIndex == 0) {
  //   varyings.position = vec4<f32>(positions[attributes.vertexIndex], 0.0, 1.0);
  //   return varyings;
  // }

  geometry.worldPosition = attributes.instancePositions;

  // Multiply out radius and clamp to limits
  varyings.outerRadiusPixels = clamp(
    project_unit_size_to_pixel(scatterplot.radiusScale * attributes.instanceRadius, scatterplot.radiusUnits),
    scatterplot.radiusMinPixels, scatterplot.radiusMaxPixels
  );

  // Multiply out line width and clamp to limits
  let lineWidthPixels = clamp(
    project_unit_size_to_pixel(scatterplot.lineWidthScale * attributes.instanceLineWidths, scatterplot.lineWidthUnits),
    scatterplot.lineWidthMinPixels, scatterplot.lineWidthMaxPixels
  );

  // outer radius needs to offset by half stroke width
  varyings.outerRadiusPixels += scatterplot.stroked * lineWidthPixels / 2.0;
  // Expand geometry to accommodate edge smoothing
  // WGSL selects the second value when the condition is true, so keep the antialiased path second.
  let edgePadding = select(
    1.0,
    (varyings.outerRadiusPixels + SMOOTH_EDGE_RADIUS) / varyings.outerRadiusPixels,
    scatterplot.antialiasing != 0
  );

  // position on the containing square in [-1, 1] space
  varyings.unitPosition = edgePadding * attributes.positions.xy;
  geometry.uv = varyings.unitPosition;
  geometry.pickingColor = PICKING_COLOR_VALUE;

  varyings.innerUnitRadius = 1.0 - scatterplot.stroked * lineWidthPixels / varyings.outerRadiusPixels;

  if (scatterplot.billboard != 0) {
    let projectedPosition = project_position_to_clipspace_and_commonspace(
      attributes.instancePositions,
      attributes.instancePositions64Low,
      vec3<f32>(0.0)
    );
    geometry.position = projectedPosition.commonPosition;
    varyings.position = projectedPosition.clipPosition;
    // DECKGL_FILTER_GL_POSITION(varyings.position, geometry);
    var offset = edgePadding * attributes.positions * varyings.outerRadiusPixels;
    offset = vec3<f32>(offset.xy + attributes.instancePixelOffset, offset.z);
    // DECKGL_FILTER_SIZE(offset, geometry);
    let clipPixels = project_pixel_size_to_clipspace(offset.xy);
    varyings.position = vec4<f32>(varyings.position.x + clipPixels.x, varyings.position.y + clipPixels.y, varyings.position.z, varyings.position.w);
    geometry.position = vec4<f32>(
      geometry.position.xy + project_pixel_size_vec2(offset.xy),
      geometry.position.zw
    );
  } else {
    var offset = edgePadding * attributes.positions * project_pixel_size_float(varyings.outerRadiusPixels);
    offset = vec3<f32>(offset.xy + project_pixel_size_vec2(attributes.instancePixelOffset), offset.z);
    // DECKGL_FILTER_SIZE(offset, geometry);
    let projectedPosition = project_position_to_clipspace_and_commonspace(
      attributes.instancePositions,
      attributes.instancePositions64Low,
      offset
    );
    geometry.position = projectedPosition.commonPosition;
    varyings.position = projectedPosition.clipPosition;
    // DECKGL_FILTER_GL_POSITION(varyings.position, geometry);
  }

  varyings.clipCoordinates = geometry.position.xy;
  clip_filterPosition(&varyings.position, geometry.worldPosition.xy);

  // Apply opacity to instance color, or return instance picking color
  varyings.vFillColor = vec4<f32>(attributes.instanceFillColors.rgb, attributes.instanceFillColors.a * layer.opacity);
  // DECKGL_FILTER_COLOR(varyings.vFillColor, geometry);
  varyings.vLineColor = vec4<f32>(attributes.instanceLineColors.rgb, attributes.instanceLineColors.a * layer.opacity);
  // DECKGL_FILTER_COLOR(varyings.vLineColor, geometry);
  varyings.pickingColor = geometry.pickingColor;

  return varyings;
}

@fragment
fn fragmentMain(varyings: Varyings) -> @location(0) vec4<f32> {
  // var geometry: Geometry;
  // geometry.uv = unitPosition;

  let distToCenter = length(varyings.unitPosition) * varyings.outerRadiusPixels;
  let inCircle = select(
    step(distToCenter, varyings.outerRadiusPixels),
    smoothedge(distToCenter, varyings.outerRadiusPixels),
    scatterplot.antialiasing != 0
  );

  if (inCircle == 0.0) {
    discard;
  }

  var fragColor: vec4<f32>;

  if (scatterplot.stroked != 0) {
    let isLine = select(
      step(varyings.innerUnitRadius * varyings.outerRadiusPixels, distToCenter),
      smoothedge(varyings.innerUnitRadius * varyings.outerRadiusPixels, distToCenter),
      scatterplot.antialiasing != 0
    );

    if (scatterplot.filled != 0) {
      fragColor = mix(varyings.vFillColor, varyings.vLineColor, isLine);
    } else {
      if (isLine == 0.0) {
        discard;
      }
      fragColor = vec4<f32>(varyings.vLineColor.rgb, varyings.vLineColor.a * isLine);
    }
  } else if (scatterplot.filled == 0) {
    discard;
  } else {
    fragColor = varyings.vFillColor;
  }

  fragColor.a *= inCircle;

  clip_filterColor(varyings.clipCoordinates);

  if (picking.isActive > 0.5) {
    if (!picking_isColorValid(varyings.pickingColor)) {
      discard;
    }
    return vec4<f32>(varyings.pickingColor, 1.0);
  }

  if (picking.isHighlightActive > 0.5) {
    let highlightedObjectColor = picking_normalizeColor(picking.highlightedObjectColor);
    if (picking_isColorZero(abs(varyings.pickingColor - highlightedObjectColor))) {
      let highLightAlpha = picking.highlightColor.a;
      let blendedAlpha = highLightAlpha + fragColor.a * (1.0 - highLightAlpha);
      if (blendedAlpha > 0.0) {
        let highLightRatio = highLightAlpha / blendedAlpha;
        fragColor = vec4<f32>(
          mix(fragColor.rgb, picking.highlightColor.rgb, highLightRatio),
          blendedAlpha
        );
      } else {
        fragColor = vec4<f32>(fragColor.rgb, 0.0);
      }
    }
  }

  // Apply premultiplied alpha as required by transparent canvas
  fragColor = deckgl_premultiplied_alpha(fragColor);

  return fragColor;
  // return vec4<f32>(0, 0, 1, 1);
}
`;function $R(i){return UR.replace("PICKING_COLOR_ATTRIBUTE",i?"@location(8) rowIndexes: u32,":"").replace("PICKING_COLOR_VALUE",i?"picking_getPickingColorFromIndex(attributes.rowIndexes)":"picking_getPickingColorFromIndex(attributes.instanceIndex)")}const Nc=0,Qm=1,GR=`struct ClipUniforms {
  enabled: i32,
  mode: i32,
  bounds: vec4<f32>,
};

@group(2) @binding(auto) var<uniform> clipUniforms: ClipUniforms;

fn clip_isInBounds(coordinates: vec2<f32>) -> bool {
  return coordinates.x >= clipUniforms.bounds.x &&
    coordinates.y >= clipUniforms.bounds.y &&
    coordinates.x < clipUniforms.bounds.z &&
    coordinates.y < clipUniforms.bounds.w;
}

fn clip_filterPosition(position: ptr<function, vec4<f32>>, instanceCoordinates: vec2<f32>) {
  if (
    clipUniforms.enabled != 0 &&
    clipUniforms.mode == ${Qm} &&
    !clip_isInBounds(instanceCoordinates)
  ) {
    *position = vec4<f32>(2.0, 2.0, 2.0, 1.0);
  }
}

fn clip_filterColor(geometryCoordinates: vec2<f32>) {
  if (
    clipUniforms.enabled != 0 &&
    clipUniforms.mode == ${Nc} &&
    !clip_isInBounds(geometryCoordinates)
  ) {
    discard;
  }
}
`,nu={name:"clip",source:GR,props:{},uniforms:{},bindingLayout:[{name:"clip",group:2}],uniformTypes:{enabled:"i32",mode:"i32",bounds:"vec4<f32>"},defaultUniforms:{enabled:0,mode:Nc,bounds:[0,0,1,1]},getUniforms(i={}){const e={};return i.enabled!==void 0&&(e.enabled=i.enabled?1:0),i.mode!==void 0&&(e.mode=i.mode==="instance"?Qm:Nc),i.bounds!==void 0&&(e.bounds=i.bounds),e}},ph=[0,0,0,255],VR={radiusUnits:"meters",radiusScale:{type:"number",min:0,value:1},radiusMinPixels:{type:"number",min:0,value:0},radiusMaxPixels:{type:"number",min:0,value:Number.MAX_SAFE_INTEGER},lineWidthUnits:"meters",lineWidthScale:{type:"number",min:0,value:1},lineWidthMinPixels:{type:"number",min:0,value:0},lineWidthMaxPixels:{type:"number",min:0,value:Number.MAX_SAFE_INTEGER},stroked:!1,filled:!0,billboard:!1,antialiasing:!0,getPosition:{type:"accessor",value:i=>i.position},getRadius:{type:"accessor",value:1},getFillColor:{type:"accessor",value:ph},getLineColor:{type:"accessor",value:ph},getLineWidth:{type:"accessor",value:1},getPixelOffset:{type:"accessor",value:[0,0]},strokeWidth:{deprecatedFor:"getLineWidth"},outline:{deprecatedFor:"stroked"},getColor:{deprecatedFor:["getFillColor","getLineColor"]}};class He extends et{getShaders(){const e=!!this.props.data?.attributes?.rowIndexes;return super.getShaders({vs:zR,fs:NR,source:$R(e),defines:e?{USE_ROW_INDEXES:!0}:{},modules:[bi,_i,vi,FR,...this.context.device.type==="webgpu"?[nu]:[]]})}initializeState(){const e=this.props.data?.attributes?.rowIndexes?{rowIndexes:{size:1,type:"uint32",noAlloc:!0}}:{};this.getAttributeManager().addInstanced({instancePositions:{size:3,type:"float64",fp64:this.use64bitPositions(),transition:!0,accessor:"getPosition"},instanceRadius:{size:1,transition:!0,accessor:"getRadius",defaultValue:1,bufferGroup:"scatterplot-instance-data"},instanceFillColors:{size:this.props.colorFormat.length,transition:!0,type:"unorm8",accessor:"getFillColor",defaultValue:[0,0,0,255],bufferGroup:"scatterplot-instance-data"},instanceLineColors:{size:this.props.colorFormat.length,transition:!0,type:"unorm8",accessor:"getLineColor",defaultValue:[0,0,0,255],bufferGroup:"scatterplot-instance-data"},instanceLineWidths:{size:1,transition:!0,accessor:"getLineWidth",defaultValue:1,bufferGroup:"scatterplot-instance-data"},instancePixelOffset:{size:2,transition:!0,accessor:"getPixelOffset",bufferGroup:"scatterplot-instance-data"},...e})}updateState(e){super.updateState(e),e.changeFlags.extensionsChanged&&(this.state.model?.destroy(),this.state.model=this._getModel(),this.getAttributeManager().invalidateAll())}draw({uniforms:e}){const{radiusUnits:t,radiusScale:n,radiusMinPixels:s,radiusMaxPixels:r,stroked:o,filled:a,billboard:c,antialiasing:l,lineWidthUnits:u,lineWidthScale:f,lineWidthMinPixels:d,lineWidthMaxPixels:h}=this.props,g={stroked:o,filled:a,billboard:c,antialiasing:l,radiusUnits:_t[t],radiusScale:n,radiusMinPixels:s,radiusMaxPixels:r,lineWidthUnits:_t[u],lineWidthScale:f,lineWidthMinPixels:d,lineWidthMaxPixels:h},p=this.state.model;p.shaderInputs.setProps({scatterplot:g}),p.draw(this.context.renderPass)}_getModel(){const e=[-1,-1,0,1,-1,0,-1,1,0,1,1,0];return new ke(this.context.device,{...this.getShaders(),id:this.props.id,bufferLayout:this.getAttributeManager().getBufferLayouts(),geometry:new ui({topology:"triangle-strip",attributes:{positions:{size:3,value:new Float32Array(e)}}}),isInstanced:!0})}}He.defaultProps=VR;He.layerName="ScatterplotLayer";const Jm={CLOCKWISE:1,COUNTER_CLOCKWISE:-1};function ey(i,e,t={}){return jR(i,t)!==e?(HR(i,t),!0):!1}function jR(i,e={}){return Math.sign(WR(i,e))}const mh={x:0,y:1,z:2};function WR(i,e={}){const{start:t=0,end:n=i.length,plane:s="xy"}=e,r=e.size||2;let o=0;const a=mh[s[0]],c=mh[s[1]];for(let l=t,u=n-r;l<n;l+=r)o+=(i[l+a]-i[u+a])*(i[l+c]+i[u+c]),u=l;return o/2}function HR(i,e){const{start:t=0,end:n=i.length,size:s=2}=e,r=(n-t)/s,o=Math.floor(r/2);for(let a=0;a<o;++a){const c=t+a*s,l=t+(r-1-a)*s;for(let u=0;u<s;++u){const f=i[c+u];i[c+u]=i[l+u],i[l+u]=f}}}function Ke(i,e){const t=e.length,n=i.length;if(n>0){let s=!0;for(let r=0;r<t;r++)if(i[n-t+r]!==e[r]){s=!1;break}if(s)return!1}for(let s=0;s<t;s++)i[n+s]=e[s];return!0}function Uc(i,e){const t=e.length;for(let n=0;n<t;n++)i[n]=e[n]}function Xn(i,e,t,n,s=[]){const r=n+e*t;for(let o=0;o<t;o++)s[o]=i[r+o];return s}function $c(i,e,t,n,s=[]){let r,o;if(t&8)r=(n[3]-i[1])/(e[1]-i[1]),o=3;else if(t&4)r=(n[1]-i[1])/(e[1]-i[1]),o=1;else if(t&2)r=(n[2]-i[0])/(e[0]-i[0]),o=2;else if(t&1)r=(n[0]-i[0])/(e[0]-i[0]),o=0;else return null;for(let a=0;a<i.length;a++)s[a]=(o&1)===a?n[o]:r*(e[a]-i[a])+i[a];return s}function Ks(i,e){let t=0;return i[0]<e[0]?t|=1:i[0]>e[2]&&(t|=2),i[1]<e[1]?t|=4:i[1]>e[3]&&(t|=8),t}function ty(i,e){const{size:t=2,broken:n=!1,gridResolution:s=10,gridOffset:r=[0,0],startIndex:o=0,endIndex:a=i.length}=e||{},c=(a-o)/t;let l=[];const u=[l],f=Xn(i,0,t,o);let d,h;const g=ny(f,s,r,[]),p=[];Ke(l,f);for(let m=1;m<c;m++){for(d=Xn(i,m,t,o,d),h=Ks(d,g);h;){$c(f,d,h,g,p);const _=Ks(p,g);_&&($c(f,p,_,g,p),h=_),Ke(l,p),Uc(f,p),qR(g,s,h),n&&l.length>t&&(l=[],u.push(l),Ke(l,f)),h=Ks(d,g)}Ke(l,d),Uc(f,d)}return n?u:u[0]}const yh=0,YR=1;function iy(i,e=null,t){if(!i.length)return[];const{size:n=2,gridResolution:s=10,gridOffset:r=[0,0],edgeTypes:o=!1}=t||{},a=[],c=[{pos:i,types:o?new Array(i.length/n).fill(YR):null,holes:e||[]}],l=[[],[]];let u=[];for(;c.length;){const{pos:f,types:d,holes:h}=c.shift();ZR(f,n,h[0]||f.length,l),u=ny(l[0],s,r,u);const g=Ks(l[1],u);if(g){let p=_h(f,d,n,0,h[0]||f.length,u,g);const m={pos:p[0].pos,types:p[0].types,holes:[]},_={pos:p[1].pos,types:p[1].types,holes:[]};c.push(m,_);for(let v=0;v<h.length;v++)p=_h(f,d,n,h[v],h[v+1]||f.length,u,g),p[0]&&(m.holes.push(m.pos.length),m.pos=Os(m.pos,p[0].pos),o&&(m.types=Os(m.types,p[0].types))),p[1]&&(_.holes.push(_.pos.length),_.pos=Os(_.pos,p[1].pos),o&&(_.types=Os(_.types,p[1].types)))}else{const p={positions:f};o&&(p.edgeTypes=d),h.length&&(p.holeIndices=h),a.push(p)}}return a}function _h(i,e,t,n,s,r,o){const a=(s-n)/t,c=[],l=[],u=[],f=[],d=[];let h,g,p;const m=Xn(i,a-1,t,n);let _=Math.sign(o&8?m[1]-r[3]:m[0]-r[2]),v=e&&e[a-1],b=0,x=0;for(let w=0;w<a;w++)h=Xn(i,w,t,n,h),g=Math.sign(o&8?h[1]-r[3]:h[0]-r[2]),p=e&&e[n/t+w],g&&_&&_!==g&&($c(m,h,o,r,d),Ke(c,d)&&u.push(v),Ke(l,d)&&f.push(v)),g<=0?(Ke(c,h)&&u.push(p),b-=g):u.length&&(u[u.length-1]=yh),g>=0?(Ke(l,h)&&f.push(p),x+=g):f.length&&(f[f.length-1]=yh),Uc(m,h),_=g,v=p;return[b?{pos:c,types:e&&u}:null,x?{pos:l,types:e&&f}:null]}function ny(i,e,t,n){const s=Math.floor((i[0]-t[0])/e)*e+t[0],r=Math.floor((i[1]-t[1])/e)*e+t[1];return n[0]=s,n[1]=r,n[2]=s+e,n[3]=r+e,n}function qR(i,e,t){t&8?(i[1]+=e,i[3]+=e):t&4?(i[1]-=e,i[3]-=e):t&2?(i[0]+=e,i[2]+=e):t&1&&(i[0]-=e,i[2]-=e)}function ZR(i,e,t,n){let s=1/0,r=-1/0,o=1/0,a=-1/0;for(let c=0;c<t;c+=e){const l=i[c],u=i[c+1];s=l<s?l:s,r=l>r?l:r,o=u<o?u:o,a=u>a?u:a}return n[0][0]=s,n[0][1]=o,n[1][0]=r,n[1][1]=a,n}function Os(i,e){for(let t=0;t<e.length;t++)i.push(e[t]);return i}const XR=85.051129;function KR(i,e){const{size:t=2,startIndex:n=0,endIndex:s=i.length,normalize:r=!0}=e||{},o=i.slice(n,s);sy(o,t,0,s-n);const a=ty(o,{size:t,broken:!0,gridResolution:360,gridOffset:[-180,-180]});if(r)for(const c of a)ry(c,t);return a}function QR(i,e=null,t){const{size:n=2,normalize:s=!0,edgeTypes:r=!1}=t||{};e=e||[];const o=[],a=[];let c=0,l=0;for(let f=0;f<=e.length;f++){const d=e[f]||i.length,h=l,g=JR(i,n,c,d);for(let p=g;p<d;p++)o[l++]=i[p];for(let p=c;p<g;p++)o[l++]=i[p];sy(o,n,h,l),eO(o,n,h,l,t?.maxLatitude),c=d,a[f]=l}a.pop();const u=iy(o,a,{size:n,gridResolution:360,gridOffset:[-180,-180],edgeTypes:r});if(s)for(const f of u)ry(f.positions,n);return u}function JR(i,e,t,n){let s=-1,r=-1;for(let o=t+1;o<n;o+=e){const a=Math.abs(i[o]);a>s&&(s=a,r=o-1)}return r}function eO(i,e,t,n,s=XR){const r=i[t],o=i[n-e];if(Math.abs(r-o)>180){const a=Xn(i,0,e,t);a[0]+=Math.round((o-r)/360)*360,Ke(i,a),a[1]=Math.sign(a[1])*s,Ke(i,a),a[0]=r,Ke(i,a)}}function sy(i,e,t,n){let s=i[0],r;for(let o=t;o<n;o+=e){r=i[o];const a=r-s;(a>180||a<-180)&&(r-=Math.round(a/360)*360),i[o]=s=r}}function ry(i,e){let t;const n=i.length/e;for(let r=0;r<n&&(t=i[r*e],(t+180)%360===0);r++);const s=-Math.round(t/360)*360;if(s!==0)for(let r=0;r<n;r++)i[r*e]+=s}function tO(i,e,t,n){let s;if(Array.isArray(i[0])){const r=i.length*e;s=new Array(r);for(let o=0;o<i.length;o++)for(let a=0;a<e;a++)s[o*e+a]=i[o][a]||0}else s=i;return t?ty(s,{size:e,gridResolution:t}):n?KR(s,{size:e}):s}const iO=1,nO=2,vn=4;class sO extends Ym{constructor(e){super({...e,attributes:{positions:{size:3,padding:18,initialize:!0,type:e.fp64?Float64Array:Float32Array},segmentTypes:{size:1,type:e.isWebGPU?Float32Array:Uint8ClampedArray}}})}get(e){return this.attributes[e]}getPathSegmentIndices(e){const t=this.attributes.segmentTypes,n=this.vertexStarts[e],s=Math.min(this.vertexStarts[e+1]??this.instanceCount,this.instanceCount),r=[];for(let o=n;o<s-1;o++)(t[o]&vn)===0&&r.push(o);return r.length&&(t[n]&vn)!==0&&r.unshift(r.pop()),r}getGeometryFromBuffer(e){return this.normalize||this.opts.isWebGPU?super.getGeometryFromBuffer(e):null}normalizeGeometry(e){return this.normalize?tO(e,this.positionSize,this.opts.resolution,this.opts.wrapLongitude):e}getGeometrySize(e){if(bh(e)){let n=0;for(const s of e)n+=this.getGeometrySize(s);return n}const t=this.getPathLength(e);return t<2?0:this.isClosed(e)?t<3?0:t+2:t}updateGeometryAttributes(e,t){if(t.geometrySize!==0)if(e&&bh(e))for(const n of e){const s=this.getGeometrySize(n);t.geometrySize=s,this.updateGeometryAttributes(n,t),t.vertexStart+=s}else this._updateSegmentTypes(e,t),this._updatePositions(e,t)}_updateSegmentTypes(e,t){const n=this.attributes.segmentTypes,s=e?this.isClosed(e):!1,{vertexStart:r,geometrySize:o}=t;n.fill(0,r,r+o),s?(n[r]=vn,n[r+o-2]=vn):(n[r]+=iO,n[r+o-2]+=nO),n[r+o-1]=vn}_updatePositions(e,t){const{positions:n}=this.attributes;if(!n||!e)return;const{vertexStart:s,geometrySize:r}=t,o=new Array(3);for(let a=s,c=0;c<r;a++,c++)this.getPointOnPath(e,c,o),n[a*3]=o[0],n[a*3+1]=o[1],n[a*3+2]=o[2]}getPathLength(e){return e.length/this.positionSize}getPointOnPath(e,t,n=[]){const{positionSize:s}=this;t*s>=e.length&&(t+=1-e.length/s);const r=t*s;return n[0]=e[r],n[1]=e[r+1],n[2]=s===3&&e[r+2]||0,n}isClosed(e){if(!this.normalize)return!!this.opts.loop;const{positionSize:t}=this,n=e.length-t;return e[0]===e[n]&&e[1]===e[n+1]&&(t===2||e[2]===e[n+2])}}function bh(i){return Array.isArray(i[0])}const rO=`struct PathUniforms {
  widthScale: f32,
  widthMinPixels: f32,
  widthMaxPixels: f32,
  jointType: f32,
  capType: f32,
  miterLimit: f32,
  billboard: f32,
  widthUnits: i32,
};

@group(0) @binding(auto)
var<uniform> path: PathUniforms;
`,vh=`layout(std140) uniform pathUniforms {
  float widthScale;
  float widthMinPixels;
  float widthMaxPixels;
  float jointType;
  float capType;
  float miterLimit;
  bool billboard;
  highp int widthUnits;
} path;
`,oO={name:"path",source:rO,vs:vh,fs:vh,uniformTypes:{widthScale:"f32",widthMinPixels:"f32",widthMaxPixels:"f32",jointType:"f32",capType:"f32",miterLimit:"f32",billboard:"f32",widthUnits:"i32"}},aO=`const EPSILON: f32 = 0.001;
const ZERO_OFFSET: vec3<f32> = vec3<f32>(0.0, 0.0, 0.0);

struct JoinResult {
  offset: vec3<f32>,
  cornerOffset: vec2<f32>,
  miterLength: f32,
  pathPosition: vec2<f32>,
  pathLength: f32,
  jointType: f32,
};

struct Attributes {
  @location(0) positions: vec2<f32>,
  @location(1) instanceTypes: f32,
  @location(2) instanceLeftPositions: vec3<f32>,
  @location(3) instanceStartPositions: vec3<f32>,
  @location(4) instanceEndPositions: vec3<f32>,
  @location(5) instanceRightPositions: vec3<f32>,
  @location(6) instanceLeftPositions64Low: vec3<f32>,
  @location(7) instanceStartPositions64Low: vec3<f32>,
  @location(8) instanceEndPositions64Low: vec3<f32>,
  @location(9) instanceRightPositions64Low: vec3<f32>,
  @location(10) instanceStrokeWidths: f32,
  @location(11) instanceColors: vec4<f32>,
  @location(12) rowIndexes: u32,
};

struct Varyings {
  @builtin(position) position: vec4<f32>,
  @location(0) vColor: vec4<f32>,
  @location(1) vCornerOffset: vec2<f32>,
  @location(2) vMiterLength: f32,
  @location(3) vPathPosition: vec2<f32>,
  @location(4) vPathLength: f32,
  @location(5) vJointType: f32,
  // Location 6 is reserved for TripsLayer's injected vTime varying.
  @location(7) clipCoordinates: vec2<f32>,
#ifdef DASH_ENABLED
  @location(8) vPathBounds: vec2<f32>,
#endif
};

fn flipIfTrue(flag: bool) -> f32 {
  return select(1.0, -1.0, flag);
}

fn clipLine(position: vec4<f32>, refPosition: vec4<f32>) -> vec4<f32> {
  if (position.w < EPSILON) {
    let r = (EPSILON - refPosition.w) / (position.w - refPosition.w);
    return refPosition + (position - refPosition) * r;
  }
  return position;
}

#ifdef DASH_ENABLED
// Return the visible interval of the original segment before clipLine moves either endpoint.
fn getClippedPathRange(startW: f32, endW: f32) -> vec2<f32> {
  let startClipped = startW < EPSILON;
  let endClipped = endW < EPSILON;
  if (startClipped && endClipped) {
    return vec2<f32>(0.0, 0.0);
  }
  if (startClipped || endClipped) {
    let intersection = clamp((EPSILON - startW) / (endW - startW), 0.0, 1.0);
    if (startClipped) {
      return vec2<f32>(intersection, 1.0);
    }
    return vec2<f32>(0.0, intersection);
  }
  return vec2<f32>(0.0, 1.0);
}
#endif

fn getLineJoinOffset(
  prevPoint: vec3<f32>,
  currPoint: vec3<f32>,
  nextPoint: vec3<f32>,
  width: vec2<f32>,
#ifdef DASH_ENABLED
  sourcePathLength: f32,
  sourcePathRange: vec2<f32>,
#endif
#ifdef ANTIALIASING
  coverageScale: f32,
#endif
  positions: vec2<f32>,
  instanceTypes: f32
) -> JoinResult {
  let isEnd = positions.x > 0.0;
  let sideOfPath = positions.y;
  let isJoint = select(0.0, 1.0, sideOfPath == 0.0);

  var deltaA3 = currPoint - prevPoint;
  var deltaB3 = nextPoint - currPoint;

  let rotationResult = project_needs_rotation(currPoint);
  if (path.billboard == 0.0 && rotationResult.needsRotation) {
    deltaA3 = rotationResult.transform * deltaA3;
    deltaB3 = rotationResult.transform * deltaB3;
  }

  let deltaA = deltaA3.xy / width;
  let deltaB = deltaB3.xy / width;

  let lenA = length(deltaA);
  let lenB = length(deltaB);

  let dirA = select(vec2<f32>(0.0, 0.0), normalize(deltaA), lenA > 0.0);
  let dirB = select(vec2<f32>(0.0, 0.0), normalize(deltaB), lenB > 0.0);

  let perpA = vec2<f32>(-dirA.y, dirA.x);
  let perpB = vec2<f32>(-dirB.y, dirB.x);

  var tangent = dirA + dirB;
  tangent = select(perpA, normalize(tangent), length(tangent) > 0.0);
  let miterVec = vec2<f32>(-tangent.y, tangent.x);
  let dir = select(dirB, dirA, isEnd);
  let perp = select(perpB, perpA, isEnd);
#ifdef DASH_ENABLED
  let segmentLength2D = select(lenB, lenA, isEnd);

  // Extrusion happens in the XY plane, so segmentLength2D is a 2D length and pathPosition.y
  // below measures 2D distance along the segment. For a path that also moves in Z the true
  // arc length is longer by this ratio. Scaling pathLength and pathPosition.y by it makes
  // the coordinate measure real 3D distance while leaving the joint tests unchanged, since
  // they compare the two against each other and both are scaled alike. Billboard mode
  // extrudes in clip space, where the perspective divide has already reduced the segment to
  // its screen projection, so its complete common-space length is supplied by the caller.
  // Mirrors path-layer-vertex.glsl.ts.
  let currDelta3 = select(deltaB3, deltaA3, isEnd);
  let currLength2D = length(currDelta3.xy);
  // Do not clamp a valid denominator to EPSILON: high-zoom Web Mercator deltas are often
  // smaller than that in common space, and changing their scale corrupts even flat paths.
  let safeLength2D = select(1.0, currLength2D, currLength2D > 0.0);
  var arcLengthRatio = 1.0;
  var pathPositionOffset = 0.0;
  var pathLength = segmentLength2D;
  if (path.billboard != 0.0) {
    // clipLine may shorten the visible screen-space segment. Preserve the corresponding interval
    // of the complete common-space arclength instead of compressing the full dash period into the
    // visible span. Keep pathLength complete so justification is stable as the camera clips it.
    let visiblePathLength = sourcePathLength * (sourcePathRange.y - sourcePathRange.x);
    arcLengthRatio = 0.0;
    if (segmentLength2D > 0.0) {
      arcLengthRatio = visiblePathLength / segmentLength2D;
    }
    pathPositionOffset = sourcePathLength * sourcePathRange.x;
    pathLength = sourcePathLength;
  } else if (currLength2D > 0.0) {
    arcLengthRatio = length(currDelta3) / safeLength2D;
    pathLength = segmentLength2D * arcLengthRatio;
  }
#else
  let pathLength = select(lenB, lenA, isEnd);
#endif

  let sinHalfA = abs(dot(miterVec, perp));
  let cosHalfA = abs(dot(dirA, miterVec));
  let turnDirection = flipIfTrue(dirA.x * dirB.y >= dirA.y * dirB.x);
  let cornerPosition = sideOfPath * turnDirection;

  var miterSize = 1.0 / max(sinHalfA, EPSILON);
  miterSize = mix(
    min(miterSize, max(lenA, lenB) / max(cosHalfA, EPSILON)),
    miterSize,
    step(0.0, cornerPosition)
  );

  var offsetVec =
    mix(miterVec * miterSize, perp, step(0.5, cornerPosition)) *
    (sideOfPath + isJoint * turnDirection);

  let isStartCap = lenA == 0.0 || (!isEnd && (instanceTypes == 1.0 || instanceTypes == 3.0));
  let isEndCap = lenB == 0.0 || (isEnd && (instanceTypes == 2.0 || instanceTypes == 3.0));
  let isCap = isStartCap || isEndCap;

  var jointType = path.jointType;
  if (isCap) {
    offsetVec = mix(
      perp * sideOfPath,
      dir * path.capType * 4.0 * flipIfTrue(isStartCap),
      isJoint
    );
    jointType = path.capType;
  }

#ifdef ANTIALIASING
  let coverageOffsetVec = offsetVec * coverageScale;
  var miterLength = dot(coverageOffsetVec, miterVec * turnDirection);
#else
  var miterLength = dot(offsetVec, miterVec * turnDirection);
#endif
  miterLength = select(miterLength, isJoint, isCap);

#ifdef ANTIALIASING
  let offsetFromStartOfPath = coverageOffsetVec + deltaA * select(0.0, 1.0, isEnd);
#else
  let offsetFromStartOfPath = offsetVec + deltaA * select(0.0, 1.0, isEnd);
#endif
  let pathPosition = vec2<f32>(
    dot(offsetFromStartOfPath, perp),
#ifdef DASH_ENABLED
    pathPositionOffset + dot(offsetFromStartOfPath, dir) * arcLengthRatio
#else
    dot(offsetFromStartOfPath, dir)
#endif
  );
  let isValid = step(f32(instanceTypes), 3.5);
#ifdef ANTIALIASING
  var offset = vec3<f32>(coverageOffsetVec * width * isValid, 0.0);
#else
  var offset = vec3<f32>(offsetVec * width * isValid, 0.0);
#endif

  if (path.billboard == 0.0 && rotationResult.needsRotation) {
    offset = rotationResult.transform * offset;
  }

#ifdef ANTIALIASING
  return JoinResult(
    offset, coverageOffsetVec, miterLength, pathPosition, pathLength, jointType
  );
#else
  return JoinResult(offset, offsetVec, miterLength, pathPosition, pathLength, jointType);
#endif
}

@vertex
fn vertexMain(attributes: Attributes) -> Varyings {
  var varyings: Varyings;

  geometry.pickingColor = picking_getPickingColorFromIndex(attributes.rowIndexes);

  let isEnd = attributes.positions.x;

  let prevPosition = mix(attributes.instanceLeftPositions, attributes.instanceStartPositions, isEnd);
  let prevPosition64Low = mix(
    attributes.instanceLeftPositions64Low,
    attributes.instanceStartPositions64Low,
    isEnd
  );
  let currPosition = mix(attributes.instanceStartPositions, attributes.instanceEndPositions, isEnd);
  let currPosition64Low = mix(
    attributes.instanceStartPositions64Low,
    attributes.instanceEndPositions64Low,
    isEnd
  );
  let nextPosition = mix(attributes.instanceEndPositions, attributes.instanceRightPositions, isEnd);
  let nextPosition64Low = mix(
    attributes.instanceEndPositions64Low,
    attributes.instanceRightPositions64Low,
    isEnd
  );

  geometry.worldPosition = currPosition;

  let widthPixels =
    clamp(
      project_unit_size_to_pixel(attributes.instanceStrokeWidths * path.widthScale, path.widthUnits),
      path.widthMinPixels,
      path.widthMaxPixels
    ) / 2.0;

  if (path.billboard != 0.0) {
#ifdef DASH_ENABLED
    let prevProjection = project_position_to_clipspace_and_commonspace(
      prevPosition, prevPosition64Low, ZERO_OFFSET
    );
    let nextProjection = project_position_to_clipspace_and_commonspace(
      nextPosition, nextPosition64Low, ZERO_OFFSET
    );
    let prevPositionCommon = prevProjection.commonPosition.xyz;
    let nextPositionCommon = nextProjection.commonPosition.xyz;
    var prevPositionScreen = prevProjection.clipPosition;
    var nextPositionScreen = nextProjection.clipPosition;
#else
    var prevPositionScreen = project_position_to_clipspace(
      prevPosition, prevPosition64Low, ZERO_OFFSET
    );
    var nextPositionScreen = project_position_to_clipspace(
      nextPosition, nextPosition64Low, ZERO_OFFSET
    );
#endif
    let currProjection = project_position_to_clipspace_and_commonspace(
      currPosition, currPosition64Low, ZERO_OFFSET
    );
    geometry.position = currProjection.commonPosition;
    var currPositionScreen = currProjection.clipPosition;
#ifdef DASH_ENABLED
    let currPositionCommon = currProjection.commonPosition.xyz;
    let sourcePathStartScreen = mix(currPositionScreen, prevPositionScreen, isEnd);
    let sourcePathEndScreen = mix(nextPositionScreen, currPositionScreen, isEnd);
    let billboardPathRange = getClippedPathRange(
      sourcePathStartScreen.w, sourcePathEndScreen.w
    );
#endif

    prevPositionScreen = clipLine(prevPositionScreen, currPositionScreen);
    nextPositionScreen = clipLine(nextPositionScreen, currPositionScreen);
    currPositionScreen = clipLine(currPositionScreen, mix(nextPositionScreen, prevPositionScreen, isEnd));

#ifdef ANTIALIASING
    let coverageScale = select(
      1.0,
      (widthPixels + 0.5 / project.devicePixelRatio) / max(widthPixels, 1e-6),
      widthPixels > 0.0
    );
#endif
#ifdef DASH_ENABLED
    let currentDeltaCommon = select(
      nextPositionCommon - currPositionCommon,
      currPositionCommon - prevPositionCommon,
      isEnd > 0.0
    );
    let billboardPathLength = select(
      0.0,
      length(currentDeltaCommon) * project.scale / (widthPixels * project.focalDistance),
      widthPixels > 0.0
    );
#endif
    let join = getLineJoinOffset(
      prevPositionScreen.xyz / prevPositionScreen.w,
      currPositionScreen.xyz / currPositionScreen.w,
      nextPositionScreen.xyz / nextPositionScreen.w,
      project_pixel_size_to_clipspace(vec2<f32>(widthPixels, widthPixels)),
#ifdef DASH_ENABLED
      billboardPathLength,
      billboardPathRange,
#endif
#ifdef ANTIALIASING
      coverageScale,
#endif
      attributes.positions,
      attributes.instanceTypes
    );
#ifdef DASH_ENABLED
    // Phase and justification use the complete source segment, while cap and joint coverage
    // must still recognize the endpoints moved by clipLine.
    varyings.vPathBounds = billboardPathLength * billboardPathRange;
#endif

    geometry.uv = join.pathPosition;
    varyings.position = vec4<f32>(
      currPositionScreen.xyz + join.offset * currPositionScreen.w,
      currPositionScreen.w
    );
    varyings.vCornerOffset = join.cornerOffset;
    varyings.vMiterLength = join.miterLength;
    varyings.vPathPosition = join.pathPosition;
    varyings.vPathLength = join.pathLength;
    varyings.vJointType = join.jointType;
  } else {
    let prevPositionCommon = project_position_vec3_f64(prevPosition, prevPosition64Low);
    let currPositionCommon = project_position_vec3_f64(currPosition, currPosition64Low);
    let nextPositionCommon = project_position_vec3_f64(nextPosition, nextPosition64Low);

    let width = vec2<f32>(
      project_pixel_size_float(widthPixels),
      project_pixel_size_float(widthPixels)
    );
#ifdef ANTIALIASING
    let coverageScale = select(
      1.0,
      (widthPixels + 0.5 / project.devicePixelRatio) / max(widthPixels, 1e-6),
      widthPixels > 0.0
    );
#endif
    let join = getLineJoinOffset(
      prevPositionCommon,
      currPositionCommon,
      nextPositionCommon,
      width,
#ifdef DASH_ENABLED
      1.0,
      vec2<f32>(0.0, 1.0),
#endif
#ifdef ANTIALIASING
      coverageScale,
#endif
      attributes.positions,
      attributes.instanceTypes
    );
#ifdef DASH_ENABLED
    varyings.vPathBounds = vec2<f32>(0.0, join.pathLength);
#endif

    geometry.position = vec4<f32>(currPositionCommon + join.offset, 1.0);
    geometry.uv = join.pathPosition;
    varyings.position = project_common_position_to_clipspace(geometry.position);
    varyings.vCornerOffset = join.cornerOffset;
    varyings.vMiterLength = join.miterLength;
    varyings.vPathPosition = join.pathPosition;
    varyings.vPathLength = join.pathLength;
    varyings.vJointType = join.jointType;
  }

  varyings.clipCoordinates = geometry.position.xy;
  clip_filterPosition(&varyings.position, geometry.worldPosition.xy);

  varyings.vColor = vec4<f32>(
    attributes.instanceColors.rgb,
    attributes.instanceColors.a * layer.opacity
  );
  return varyings;
}

@fragment
fn fragmentMain(varyings: Varyings) -> @location(0) vec4<f32> {
  geometry.uv = varyings.vPathPosition;

#ifdef ANTIALIASING
  // Coordinates of the outer silhouette, in units of half-width: rounded joints and caps are
  // bounded by the corner offset, everywhere else by the edge of the stroke. Dividing by the
  // screen-space derivative converts the distance to the boundary into device pixels, which stays
  // correct under perspective foreshortening and under extensions that rescale the stroke.
#ifdef DASH_ENABLED
  let isCorner =
    varyings.vPathPosition.y < varyings.vPathBounds.x ||
    varyings.vPathPosition.y > varyings.vPathBounds.y;
#else
  let isCorner = varyings.vPathPosition.y < 0.0 || varyings.vPathPosition.y > varyings.vPathLength;
#endif
  let isRound = varyings.vJointType > 0.5;

  // Distance to the silhouette in device pixels, from the derivative of the coordinate that
  // bounds it. Computed before the discards below: derivatives need uniform control flow and are
  // undefined after a discard in the quad. See dev-docs/RFCs/v9.4/analytic-antialiasing-rfc.md
  let bodyCoord = abs(varyings.vPathPosition.x);
  let cornerCoord = length(varyings.vCornerOffset);
  // Both evaluated so each derivative stays on one field across the corner/body boundary
  let bodyPixels = (1.0 - bodyCoord) / max(fwidth(bodyCoord), 1e-6);
  let cornerPixels = (1.0 - cornerCoord) / max(fwidth(cornerCoord), 1e-6);
#ifdef PATH_STYLE_OFFSET
  // Rounded corners still intersect the stroke-width envelope. Extensions may remap
  // vPathPosition.x independently of vCornerOffset, as PathStyleExtension does for offsets.
  let edgePixels = select(bodyPixels, min(cornerPixels, bodyPixels), isRound && isCorner);
#else
  let edgePixels = select(bodyPixels, cornerPixels, isRound && isCorner);
#endif

  // Fragments outside the coverage ramp must not write depth or picking colors.
  if (edgePixels <= -SMOOTH_EDGE_RADIUS) {
    discard;
  }

  if (isCorner) {
    if (!isRound && varyings.vMiterLength > path.miterLimit + 1.0) {
      discard;
    }
  }

  var color = varyings.vColor;

  // Feather one device pixel across the width only, before premultiplication. edgePixels is a
  // signed device-pixel distance and SMOOTH_EDGE_RADIUS is 0.5, so this ramps across one pixel.
  color.a *= smoothedge(0.0, edgePixels);
#else
#ifdef DASH_ENABLED
  if (
    varyings.vPathPosition.y < varyings.vPathBounds.x ||
    varyings.vPathPosition.y > varyings.vPathBounds.y
  ) {
#else
  if (
    varyings.vPathPosition.y < 0.0 ||
    varyings.vPathPosition.y > varyings.vPathLength
  ) {
#endif
    if (varyings.vJointType > 0.5 && length(varyings.vCornerOffset) > 1.0) {
      discard;
    }
    if (
      varyings.vJointType < 0.5 &&
      varyings.vMiterLength > path.miterLimit + 1.0
    ) {
      discard;
    }
  }
#endif

  // Fragment-layer injections that discard pixels must run after analytic coverage derivatives.
  // See TripsLayer, which rejects fragments outside of the active time window at this anchor.
  // DECKGL_FILTER_COLOR
  clip_filterColor(varyings.clipCoordinates);
#ifdef ANTIALIASING
  return deckgl_premultiplied_alpha(color);
#else
  return deckgl_premultiplied_alpha(varyings.vColor);
#endif
}
`,cO=`#version 300 es
#define SHADER_NAME path-layer-vertex-shader
in vec2 positions;
in float instanceTypes;
in vec3 instanceStartPositions;
in vec3 instanceEndPositions;
in vec3 instanceLeftPositions;
in vec3 instanceRightPositions;
in vec3 instanceLeftPositions64Low;
in vec3 instanceStartPositions64Low;
in vec3 instanceEndPositions64Low;
in vec3 instanceRightPositions64Low;
in float instanceStrokeWidths;
in vec4 instanceColors;
in float rowIndexes;
uniform float opacity;
out vec4 vColor;
out vec2 vCornerOffset;
out float vMiterLength;
out vec2 vPathPosition;
out float vPathLength;
out float vJointType;
#ifdef DASH_ENABLED
out vec2 vPathBounds;
#endif
const float EPSILON = 0.001;
const vec3 ZERO_OFFSET = vec3(0.0);
float flipIfTrue(bool flag) {
return -(float(flag) * 2. - 1.);
}
vec3 getLineJoinOffset(
vec3 prevPoint, vec3 currPoint, vec3 nextPoint,
vec2 width
#ifdef DASH_ENABLED
, float sourcePathLength, vec2 sourcePathRange
#endif
#ifdef ANTIALIASING
, float coverageScale
#endif
) {
bool isEnd = positions.x > 0.0;
float sideOfPath = positions.y;
float isJoint = float(sideOfPath == 0.0);
vec3 deltaA3 = (currPoint - prevPoint);
vec3 deltaB3 = (nextPoint - currPoint);
mat3 rotationMatrix;
bool needsRotation = !path.billboard && project_needs_rotation(currPoint, rotationMatrix);
if (needsRotation) {
deltaA3 = deltaA3 * rotationMatrix;
deltaB3 = deltaB3 * rotationMatrix;
}
vec2 deltaA = deltaA3.xy / width;
vec2 deltaB = deltaB3.xy / width;
float lenA = length(deltaA);
float lenB = length(deltaB);
vec2 dirA = lenA > 0. ? normalize(deltaA) : vec2(0.0, 0.0);
vec2 dirB = lenB > 0. ? normalize(deltaB) : vec2(0.0, 0.0);
vec2 perpA = vec2(-dirA.y, dirA.x);
vec2 perpB = vec2(-dirB.y, dirB.x);
vec2 tangent = dirA + dirB;
tangent = length(tangent) > 0. ? normalize(tangent) : perpA;
vec2 miterVec = vec2(-tangent.y, tangent.x);
vec2 dir = isEnd ? dirA : dirB;
vec2 perp = isEnd ? perpA : perpB;
float L = isEnd ? lenA : lenB;
#ifdef DASH_ENABLED
vec3 currDelta3 = isEnd ? deltaA3 : deltaB3;
float currLength2D = length(currDelta3.xy);
float arcLengthRatio = 1.0;
float pathPositionOffset = 0.0;
float pathLength = L;
if (path.billboard) {
float visiblePathLength = sourcePathLength * (sourcePathRange.y - sourcePathRange.x);
arcLengthRatio = L > 0.0 ? visiblePathLength / L : 0.0;
pathPositionOffset = sourcePathLength * sourcePathRange.x;
pathLength = sourcePathLength;
} else if (currLength2D > 0.0) {
arcLengthRatio = length(currDelta3) / currLength2D;
pathLength = L * arcLengthRatio;
}
#endif
float sinHalfA = abs(dot(miterVec, perp));
float cosHalfA = abs(dot(dirA, miterVec));
float turnDirection = flipIfTrue(dirA.x * dirB.y >= dirA.y * dirB.x);
float cornerPosition = sideOfPath * turnDirection;
float miterSize = 1.0 / max(sinHalfA, EPSILON);
miterSize = mix(
min(miterSize, max(lenA, lenB) / max(cosHalfA, EPSILON)),
miterSize,
step(0.0, cornerPosition)
);
vec2 offsetVec = mix(miterVec * miterSize, perp, step(0.5, cornerPosition))
* (sideOfPath + isJoint * turnDirection);
bool isStartCap = lenA == 0.0 || (!isEnd && (instanceTypes == 1.0 || instanceTypes == 3.0));
bool isEndCap = lenB == 0.0 || (isEnd && (instanceTypes == 2.0 || instanceTypes == 3.0));
bool isCap = isStartCap || isEndCap;
if (isCap) {
offsetVec = mix(perp * sideOfPath, dir * path.capType * 4.0 * flipIfTrue(isStartCap), isJoint);
vJointType = path.capType;
} else {
vJointType = path.jointType;
}
#ifdef ANTIALIASING
vec2 coverageOffsetVec = offsetVec * coverageScale;
#ifdef DASH_ENABLED
vPathLength = pathLength;
#else
vPathLength = L;
#endif
vCornerOffset = coverageOffsetVec;
vMiterLength = dot(vCornerOffset, miterVec * turnDirection);
vMiterLength = isCap ? isJoint : vMiterLength;
vec2 offsetFromStartOfPath = coverageOffsetVec + deltaA * float(isEnd);
vPathPosition = vec2(
dot(offsetFromStartOfPath, perp),
#ifdef DASH_ENABLED
pathPositionOffset + dot(offsetFromStartOfPath, dir) * arcLengthRatio
#else
dot(offsetFromStartOfPath, dir)
#endif
);
geometry.uv = vPathPosition;
float isValid = step(instanceTypes, 3.5);
vec3 offset = vec3(coverageOffsetVec * width * isValid, 0.0);
#else
#ifdef DASH_ENABLED
vPathLength = pathLength;
#else
vPathLength = L;
#endif
vCornerOffset = offsetVec;
vMiterLength = dot(vCornerOffset, miterVec * turnDirection);
vMiterLength = isCap ? isJoint : vMiterLength;
vec2 offsetFromStartOfPath = vCornerOffset + deltaA * float(isEnd);
vPathPosition = vec2(
dot(offsetFromStartOfPath, perp),
#ifdef DASH_ENABLED
pathPositionOffset + dot(offsetFromStartOfPath, dir) * arcLengthRatio
#else
dot(offsetFromStartOfPath, dir)
#endif
);
geometry.uv = vPathPosition;
float isValid = step(instanceTypes, 3.5);
vec3 offset = vec3(offsetVec * width * isValid, 0.0);
#endif
if (needsRotation) {
offset = rotationMatrix * offset;
}
return offset;
}
void clipLine(inout vec4 position, vec4 refPosition) {
if (position.w < EPSILON) {
float r = (EPSILON - refPosition.w) / (position.w - refPosition.w);
position = refPosition + (position - refPosition) * r;
}
}
#ifdef DASH_ENABLED
vec2 getClippedPathRange(float startW, float endW) {
bool startClipped = startW < EPSILON;
bool endClipped = endW < EPSILON;
if (startClipped && endClipped) {
return vec2(0.0);
}
if (startClipped || endClipped) {
float intersection = clamp((EPSILON - startW) / (endW - startW), 0.0, 1.0);
return startClipped ? vec2(intersection, 1.0) : vec2(0.0, intersection);
}
return vec2(0.0, 1.0);
}
#endif
void main() {
geometry.pickingColor = picking_getPickingColorFromIndex(rowIndexes);
vColor = vec4(instanceColors.rgb, instanceColors.a * layer.opacity);
float isEnd = positions.x;
vec3 prevPosition = mix(instanceLeftPositions, instanceStartPositions, isEnd);
vec3 prevPosition64Low = mix(instanceLeftPositions64Low, instanceStartPositions64Low, isEnd);
vec3 currPosition = mix(instanceStartPositions, instanceEndPositions, isEnd);
vec3 currPosition64Low = mix(instanceStartPositions64Low, instanceEndPositions64Low, isEnd);
vec3 nextPosition = mix(instanceEndPositions, instanceRightPositions, isEnd);
vec3 nextPosition64Low = mix(instanceEndPositions64Low, instanceRightPositions64Low, isEnd);
geometry.worldPosition = currPosition;
vec2 widthPixels = vec2(clamp(
project_size_to_pixel(instanceStrokeWidths * path.widthScale, path.widthUnits),
path.widthMinPixels, path.widthMaxPixels) / 2.0);
vec3 width;
if (path.billboard) {
#ifdef DASH_ENABLED
vec4 prevPositionCommon;
vec4 nextPositionCommon;
vec4 prevPositionScreen = project_position_to_clipspace(
prevPosition, prevPosition64Low, ZERO_OFFSET, prevPositionCommon
);
#else
vec4 prevPositionScreen = project_position_to_clipspace(
prevPosition, prevPosition64Low, ZERO_OFFSET
);
#endif
vec4 currPositionScreen = project_position_to_clipspace(currPosition, currPosition64Low, ZERO_OFFSET, geometry.position);
#ifdef DASH_ENABLED
vec4 nextPositionScreen = project_position_to_clipspace(
nextPosition, nextPosition64Low, ZERO_OFFSET, nextPositionCommon
);
#else
vec4 nextPositionScreen = project_position_to_clipspace(
nextPosition, nextPosition64Low, ZERO_OFFSET
);
#endif
#ifdef DASH_ENABLED
vec4 sourcePathStartScreen = mix(currPositionScreen, prevPositionScreen, isEnd);
vec4 sourcePathEndScreen = mix(nextPositionScreen, currPositionScreen, isEnd);
vec2 billboardPathRange = getClippedPathRange(
sourcePathStartScreen.w, sourcePathEndScreen.w
);
#endif
clipLine(prevPositionScreen, currPositionScreen);
clipLine(nextPositionScreen, currPositionScreen);
clipLine(currPositionScreen, mix(nextPositionScreen, prevPositionScreen, isEnd));
width = vec3(widthPixels, 0.0);
DECKGL_FILTER_SIZE(width, geometry);
#ifdef ANTIALIASING
vec2 coveragePadding = vec2(0.5 / project.devicePixelRatio);
float coverageScale = length(width.xy) > 0.0
? length(width.xy + coveragePadding) / length(width.xy)
: 1.0;
#endif
#ifdef DASH_ENABLED
vec3 currentDeltaCommon = isEnd > 0.0
? geometry.position.xyz - prevPositionCommon.xyz
: nextPositionCommon.xyz - geometry.position.xyz;
float billboardPathLength = width.x > 0.0
? length(currentDeltaCommon) * project.scale / (width.x * project.focalDistance)
: 0.0;
#endif
vec3 offset = getLineJoinOffset(
prevPositionScreen.xyz / prevPositionScreen.w,
currPositionScreen.xyz / currPositionScreen.w,
nextPositionScreen.xyz / nextPositionScreen.w,
project_pixel_size_to_clipspace(width.xy)
#ifdef DASH_ENABLED
,
billboardPathLength, billboardPathRange
#endif
#ifdef ANTIALIASING
,
coverageScale
#endif
);
#ifdef DASH_ENABLED
vPathBounds = billboardPathLength * billboardPathRange;
#endif
DECKGL_FILTER_GL_POSITION(currPositionScreen, geometry);
gl_Position = vec4(currPositionScreen.xyz + offset * currPositionScreen.w, currPositionScreen.w);
} else {
prevPosition = project_position(prevPosition, prevPosition64Low);
currPosition = project_position(currPosition, currPosition64Low);
nextPosition = project_position(nextPosition, nextPosition64Low);
width = vec3(project_pixel_size(widthPixels), 0.0);
DECKGL_FILTER_SIZE(width, geometry);
#ifdef ANTIALIASING
vec2 coveragePadding = project_pixel_size(vec2(0.5 / project.devicePixelRatio));
float coverageScale = length(width.xy) > 0.0
? length(width.xy + coveragePadding) / length(width.xy)
: 1.0;
#endif
vec3 offset = getLineJoinOffset(
prevPosition, currPosition, nextPosition, width.xy
#ifdef DASH_ENABLED
, 1.0, vec2(0.0, 1.0)
#endif
#ifdef ANTIALIASING
, coverageScale
#endif
);
#ifdef DASH_ENABLED
vPathBounds = vec2(0.0, vPathLength);
#endif
geometry.position = vec4(currPosition + offset, 1.0);
gl_Position = project_common_position_to_clipspace(geometry.position);
DECKGL_FILTER_GL_POSITION(gl_Position, geometry);
}
DECKGL_FILTER_COLOR(vColor, geometry);
}
`,lO=`#version 300 es
#define SHADER_NAME path-layer-fragment-shader
precision highp float;
in vec4 vColor;
in vec2 vCornerOffset;
in float vMiterLength;
in vec2 vPathPosition;
in float vPathLength;
in float vJointType;
#ifdef DASH_ENABLED
in vec2 vPathBounds;
#endif
out vec4 fragColor;
void main(void) {
geometry.uv = vPathPosition;
#ifdef ANTIALIASING
#ifdef DASH_ENABLED
bool isCorner = vPathPosition.y < vPathBounds.x || vPathPosition.y > vPathBounds.y;
#else
bool isCorner = vPathPosition.y < 0.0 || vPathPosition.y > vPathLength;
#endif
bool isRound = vJointType > 0.5;
float bodyCoord = abs(vPathPosition.x);
float cornerCoord = length(vCornerOffset);
float bodyPixels = (1.0 - bodyCoord) / max(fwidth(bodyCoord), 1e-6);
float cornerPixels = (1.0 - cornerCoord) / max(fwidth(cornerCoord), 1e-6);
#ifdef PATH_STYLE_OFFSET
float edgePixels = isRound && isCorner ? min(cornerPixels, bodyPixels) : bodyPixels;
#else
float edgePixels = isRound && isCorner ? cornerPixels : bodyPixels;
#endif
if (edgePixels <= -SMOOTH_EDGE_RADIUS) {
discard;
}
if (isCorner) {
if (!isRound && vMiterLength > path.miterLimit + 1.0) {
discard;
}
}
fragColor = vColor;
fragColor.a *= smoothedge(0.0, edgePixels);
#else
#ifdef DASH_ENABLED
if (vPathPosition.y < vPathBounds.x || vPathPosition.y > vPathBounds.y) {
#else
if (vPathPosition.y < 0.0 || vPathPosition.y > vPathLength) {
#endif
if (vJointType > 0.5 && length(vCornerOffset) > 1.0) {
discard;
}
if (vJointType < 0.5 && vMiterLength > path.miterLimit + 1.0) {
discard;
}
}
fragColor = vColor;
#endif
DECKGL_FILTER_COLOR(fragColor, geometry);
}
`,oy=[0,0,0,255],uO={widthUnits:"meters",widthScale:{type:"number",min:0,value:1},widthMinPixels:{type:"number",min:0,value:0},widthMaxPixels:{type:"number",min:0,value:Number.MAX_SAFE_INTEGER},jointRounded:!1,capRounded:!1,miterLimit:{type:"number",min:0,value:4},antialiasing:!1,billboard:!1,_pathType:null,getPath:{type:"accessor",value:i=>i.path},getColor:{type:"accessor",value:oy},getWidth:{type:"accessor",value:1},rounded:{deprecatedFor:["jointRounded","capRounded"]}},La={enter:(i,e)=>e.length?e.subarray(e.length-i.length):i};function fO(i){if(i.isGeospatial)return null;const{unitsPerMeter:e}=i.distanceScales;return[e[0],e[1],e[2]]}function xh(i,e){return i===e||!!(i&&e&&i.length===e.length&&i.every((t,n)=>t===e[n]))}class ao extends et{getShaders(){const{antialiasing:e}=this.props;return super.getShaders({vs:cO,fs:lO,source:aO,defines:e?{ANTIALIASING:1}:{},modules:[bi,_i,vi,oO,...this.context.device.type==="webgpu"?[nu]:[]]})}get wrapLongitude(){return!1}getBounds(){return this.context.device.type==="webgpu"?null:this.getAttributeManager()?.getBounds(["vertexPositions"])}getPathProjectionScale(e){const t=this.props.coordinateSystem;if(!!!this.getAttributeManager()?.getAttributes().instanceDashOffsets)return null;if(e instanceof St&&e.zoom>=12&&(t==="default"||t==="lnglat"||t==="cartesian")){const o=io.getUniforms({viewport:e,coordinateSystem:t,coordinateOrigin:this.props.coordinateOrigin,autoWrapLongitude:this.wrapLongitude});return[e.projectionMode,o.coordinateOrigin[1],o.commonOrigin[1],...o.commonUnitsPerWorldUnit,...o.commonUnitsPerWorldUnit2,o.commonUnitsPerMeter[2]]}const r=fO(e);return r?[e.projectionMode,...r]:[e.projectionMode]}shouldUpdateState(e){const{viewport:t}=this.context;return super.shouldUpdateState(e)||this.state?.tessellationResolution!==t.resolution||!xh(this.state?.pathProjectionScale,this.getPathProjectionScale(t))}initializeState(){const t=this.context.device.type==="webgpu";this.getAttributeManager().addInstanced({...t?{pathPositions:{size:24,type:"float32",transition:!1,accessor:"getPath",update:this.calculateWebGPUPositions,shaderAttributes:{instanceLeftPositions:{size:3,elementOffset:0},instanceStartPositions:{size:3,elementOffset:3},instanceEndPositions:{size:3,elementOffset:6},instanceRightPositions:{size:3,elementOffset:9},instanceLeftPositions64Low:{size:3,elementOffset:12},instanceStartPositions64Low:{size:3,elementOffset:15},instanceEndPositions64Low:{size:3,elementOffset:18},instanceRightPositions64Low:{size:3,elementOffset:21}},noAlloc:!0}}:{vertexPositions:{size:3,vertexOffset:1,type:"float64",fp64:this.use64bitPositions(),transition:La,accessor:"getPath",update:this.calculatePositions,noAlloc:!0,shaderAttributes:{instanceLeftPositions:{vertexOffset:0},instanceStartPositions:{vertexOffset:1},instanceEndPositions:{vertexOffset:2},instanceRightPositions:{vertexOffset:3}}}},instanceTypes:{size:1,type:t?"float32":"uint8",update:this.calculateSegmentTypes,noAlloc:!0},instanceStrokeWidths:{size:1,accessor:"getWidth",transition:t?!1:La,defaultValue:1,bufferGroup:"path-instance-data"},instanceColors:{size:this.props.colorFormat.length,type:"unorm8",accessor:"getColor",transition:t?!1:La,defaultValue:oy,bufferGroup:"path-instance-data"},rowIndexes:{size:1,type:"uint32",accessor:(s,{index:r})=>s&&s.__source?s.__source.index:r,bufferGroup:"path-instance-data"}}),this.setState({pathTesselator:new sO({fp64:this.use64bitPositions(),isWebGPU:t}),tessellationResolution:this.context.viewport.resolution,pathProjectionScale:this.getPathProjectionScale(this.context.viewport)})}updateState(e){super.updateState(e);const{props:t,oldProps:n,changeFlags:s}=e,r=this.getAttributeManager(),{viewport:o}=this.context,a=this.state.tessellationResolution!==o.resolution,c=this.getPathProjectionScale(o),l=!xh(this.state.pathProjectionScale,c),f=s.updateTriggersChanged&&(s.updateTriggersChanged.all||s.updateTriggersChanged.getPath)||t._pathType!==n._pathType||t.positionFormat!==n.positionFormat||t.wrapLongitude!==n.wrapLongitude||a;if(s.dataChanged||f){const{pathTesselator:h}=this.state,g=t.data.attributes||{};h.updateGeometry({data:t.data,geometryBuffer:g.getPath,buffers:g,normalize:!t._pathType,loop:t._pathType==="loop",getGeometry:t.getPath,positionFormat:t.positionFormat,wrapLongitude:t.wrapLongitude,resolution:o.resolution,dataChanged:f?void 0:s.dataChanged}),this.setState({numInstances:h.instanceCount,startIndices:h.vertexStarts,tessellationResolution:o.resolution,pathProjectionScale:c}),!s.dataChanged||f?r.invalidateAll():l&&r.invalidate("instanceDashOffsets")}else l&&(this.setState({pathProjectionScale:c}),r.invalidate("instanceDashOffsets"));(s.extensionsChanged||t.antialiasing!==n.antialiasing)&&(this.state.model?.destroy(),this.state.model=this._getModel(),r.invalidateAll())}getPickingInfo(e){const t=super.getPickingInfo(e),{index:n}=t,s=this.props.data;return s[0]&&s[0].__source&&(t.object=s.find(r=>r.__source.index===n)),t}disablePickingIndex(e){const t=this.props.data;if(t[0]&&t[0].__source)for(let n=0;n<t.length;n++)t[n].__source.index===e&&this._disablePickingIndex(n);else super.disablePickingIndex(e)}draw({uniforms:e}){const{jointRounded:t,capRounded:n,billboard:s,miterLimit:r,widthUnits:o,widthScale:a,widthMinPixels:c,widthMaxPixels:l}=this.props,u=this.state.model,f={jointType:Number(t),capType:Number(n),billboard:s,widthUnits:_t[o],widthScale:a,miterLimit:r,widthMinPixels:c,widthMaxPixels:l};u.shaderInputs.setProps({path:f}),u.draw(this.context.renderPass)}_getModel(){const e=[0,1,2,1,4,2,1,3,4,3,5,4],t=[0,0,0,-1,0,1,1,-1,1,1,1,0];return new ke(this.context.device,{...this.getShaders(),id:this.props.id,bufferLayout:this.getAttributeManager().getBufferLayouts(),geometry:new ui({topology:"triangle-list",attributes:{indices:new Uint16Array(e),positions:{value:new Float32Array(t),size:2}}}),isInstanced:!0})}calculatePositions(e){const{pathTesselator:t}=this.state;e.startIndices=t.vertexStarts,e.value=t.get("positions")}calculateSegmentTypes(e){const{pathTesselator:t}=this.state;e.startIndices=t.vertexStarts,e.value=t.get("segmentTypes")}calculateWebGPUPositions(e){const{pathTesselator:t}=this.state,n=t.get("positions");if(!n){e.value=null;return}const s=t.instanceCount,r=new Float32Array(s*24),o=[-1,0,1,2];for(let a=0;a<s;a++){const c=a*24;for(let l=0;l<4;l++){const u=a+o[l],f=c+l*3;for(let d=0;d<3;d++){const h=u>=0&&u<s?n[u*3+d]:0,g=Math.fround(h);r[f+d]=g,r[f+d+12]=h-g}}}e.startIndices=t.vertexStarts,e.value=r}}ao.defaultProps=uO;ao.layerName="PathLayer";var ks={exports:{}},wh;function dO(){if(wh)return ks.exports;wh=1,ks.exports=i,ks.exports.default=i;function i(y,S,P){P=P||2;var T=S&&S.length,L=T?S[0]*P:y.length,I=e(y,0,L,P,!0),R=[];if(!I||I.next===I.prev)return R;var U,Y,j,ee,ae,ie,be;if(T&&(I=c(y,S,I,P)),y.length>80*P){U=j=y[0],Y=ee=y[1];for(var oe=P;oe<L;oe+=P)ae=y[oe],ie=y[oe+1],ae<U&&(U=ae),ie<Y&&(Y=ie),ae>j&&(j=ae),ie>ee&&(ee=ie);be=Math.max(j-U,ee-Y),be=be!==0?32767/be:0}return n(I,R,P,U,Y,be,0),R}function e(y,S,P,T,L){var I,R;if(L===J(y,S,P,T)>0)for(I=S;I<P;I+=T)R=G(I,y[I],y[I+1],R);else for(I=P-T;I>=S;I-=T)R=G(I,y[I],y[I+1],R);return R&&x(R,R.next)&&(z(R),R=R.next),R}function t(y,S){if(!y)return y;S||(S=y);var P=y,T;do if(T=!1,!P.steiner&&(x(P,P.next)||b(P.prev,P,P.next)===0)){if(z(P),P=S=P.prev,P===P.next)break;T=!0}else P=P.next;while(T||P!==S);return S}function n(y,S,P,T,L,I,R){if(y){!R&&I&&h(y,T,L,I);for(var U=y,Y,j;y.prev!==y.next;){if(Y=y.prev,j=y.next,I?r(y,T,L,I):s(y)){S.push(Y.i/P|0),S.push(y.i/P|0),S.push(j.i/P|0),z(y),y=j.next,U=j.next;continue}if(y=j,y===U){R?R===1?(y=o(t(y),S,P),n(y,S,P,T,L,I,2)):R===2&&a(y,S,P,T,L,I):n(t(y),S,P,T,L,I,1);break}}}}function s(y){var S=y.prev,P=y,T=y.next;if(b(S,P,T)>=0)return!1;for(var L=S.x,I=P.x,R=T.x,U=S.y,Y=P.y,j=T.y,ee=L<I?L<R?L:R:I<R?I:R,ae=U<Y?U<j?U:j:Y<j?Y:j,ie=L>I?L>R?L:R:I>R?I:R,be=U>Y?U>j?U:j:Y>j?Y:j,oe=T.next;oe!==S;){if(oe.x>=ee&&oe.x<=ie&&oe.y>=ae&&oe.y<=be&&_(L,U,I,Y,R,j,oe.x,oe.y)&&b(oe.prev,oe,oe.next)>=0)return!1;oe=oe.next}return!0}function r(y,S,P,T){var L=y.prev,I=y,R=y.next;if(b(L,I,R)>=0)return!1;for(var U=L.x,Y=I.x,j=R.x,ee=L.y,ae=I.y,ie=R.y,be=U<Y?U<j?U:j:Y<j?Y:j,oe=ee<ae?ee<ie?ee:ie:ae<ie?ae:ie,tt=U>Y?U>j?U:j:Y>j?Y:j,vt=ee>ae?ee>ie?ee:ie:ae>ie?ae:ie,cs=p(be,oe,S,P,T),xt=p(tt,vt,S,P,T),te=y.prevZ,ne=y.nextZ;te&&te.z>=cs&&ne&&ne.z<=xt;){if(te.x>=be&&te.x<=tt&&te.y>=oe&&te.y<=vt&&te!==L&&te!==R&&_(U,ee,Y,ae,j,ie,te.x,te.y)&&b(te.prev,te,te.next)>=0||(te=te.prevZ,ne.x>=be&&ne.x<=tt&&ne.y>=oe&&ne.y<=vt&&ne!==L&&ne!==R&&_(U,ee,Y,ae,j,ie,ne.x,ne.y)&&b(ne.prev,ne,ne.next)>=0))return!1;ne=ne.nextZ}for(;te&&te.z>=cs;){if(te.x>=be&&te.x<=tt&&te.y>=oe&&te.y<=vt&&te!==L&&te!==R&&_(U,ee,Y,ae,j,ie,te.x,te.y)&&b(te.prev,te,te.next)>=0)return!1;te=te.prevZ}for(;ne&&ne.z<=xt;){if(ne.x>=be&&ne.x<=tt&&ne.y>=oe&&ne.y<=vt&&ne!==L&&ne!==R&&_(U,ee,Y,ae,j,ie,ne.x,ne.y)&&b(ne.prev,ne,ne.next)>=0)return!1;ne=ne.nextZ}return!0}function o(y,S,P){var T=y;do{var L=T.prev,I=T.next.next;!x(L,I)&&w(L,T,T.next,I)&&D(L,I)&&D(I,L)&&(S.push(L.i/P|0),S.push(T.i/P|0),S.push(I.i/P|0),z(T),z(T.next),T=y=I),T=T.next}while(T!==y);return t(T)}function a(y,S,P,T,L,I){var R=y;do{for(var U=R.next.next;U!==R.prev;){if(R.i!==U.i&&v(R,U)){var Y=W(R,U);R=t(R,R.next),Y=t(Y,Y.next),n(R,S,P,T,L,I,0),n(Y,S,P,T,L,I,0);return}U=U.next}R=R.next}while(R!==y)}function c(y,S,P,T){var L=[],I,R,U,Y,j;for(I=0,R=S.length;I<R;I++)U=S[I]*T,Y=I<R-1?S[I+1]*T:y.length,j=e(y,U,Y,T,!1),j===j.next&&(j.steiner=!0),L.push(m(j));for(L.sort(l),I=0;I<L.length;I++)P=u(L[I],P);return P}function l(y,S){return y.x-S.x}function u(y,S){var P=f(y,S);if(!P)return S;var T=W(P,y);return t(T,T.next),t(P,P.next)}function f(y,S){var P=S,T=y.x,L=y.y,I=-1/0,R;do{if(L<=P.y&&L>=P.next.y&&P.next.y!==P.y){var U=P.x+(L-P.y)*(P.next.x-P.x)/(P.next.y-P.y);if(U<=T&&U>I&&(I=U,R=P.x<P.next.x?P:P.next,U===T))return R}P=P.next}while(P!==S);if(!R)return null;var Y=R,j=R.x,ee=R.y,ae=1/0,ie;P=R;do T>=P.x&&P.x>=j&&T!==P.x&&_(L<ee?T:I,L,j,ee,L<ee?I:T,L,P.x,P.y)&&(ie=Math.abs(L-P.y)/(T-P.x),D(P,y)&&(ie<ae||ie===ae&&(P.x>R.x||P.x===R.x&&d(R,P)))&&(R=P,ae=ie)),P=P.next;while(P!==Y);return R}function d(y,S){return b(y.prev,y,S.prev)<0&&b(S.next,y,y.next)<0}function h(y,S,P,T){var L=y;do L.z===0&&(L.z=p(L.x,L.y,S,P,T)),L.prevZ=L.prev,L.nextZ=L.next,L=L.next;while(L!==y);L.prevZ.nextZ=null,L.prevZ=null,g(L)}function g(y){var S,P,T,L,I,R,U,Y,j=1;do{for(P=y,y=null,I=null,R=0;P;){for(R++,T=P,U=0,S=0;S<j&&(U++,T=T.nextZ,!!T);S++);for(Y=j;U>0||Y>0&&T;)U!==0&&(Y===0||!T||P.z<=T.z)?(L=P,P=P.nextZ,U--):(L=T,T=T.nextZ,Y--),I?I.nextZ=L:y=L,L.prevZ=I,I=L;P=T}I.nextZ=null,j*=2}while(R>1);return y}function p(y,S,P,T,L){return y=(y-P)*L|0,S=(S-T)*L|0,y=(y|y<<8)&16711935,y=(y|y<<4)&252645135,y=(y|y<<2)&858993459,y=(y|y<<1)&1431655765,S=(S|S<<8)&16711935,S=(S|S<<4)&252645135,S=(S|S<<2)&858993459,S=(S|S<<1)&1431655765,y|S<<1}function m(y){var S=y,P=y;do(S.x<P.x||S.x===P.x&&S.y<P.y)&&(P=S),S=S.next;while(S!==y);return P}function _(y,S,P,T,L,I,R,U){return(L-R)*(S-U)>=(y-R)*(I-U)&&(y-R)*(T-U)>=(P-R)*(S-U)&&(P-R)*(I-U)>=(L-R)*(T-U)}function v(y,S){return y.next.i!==S.i&&y.prev.i!==S.i&&!F(y,S)&&(D(y,S)&&D(S,y)&&k(y,S)&&(b(y.prev,y,S.prev)||b(y,S.prev,S))||x(y,S)&&b(y.prev,y,y.next)>0&&b(S.prev,S,S.next)>0)}function b(y,S,P){return(S.y-y.y)*(P.x-S.x)-(S.x-y.x)*(P.y-S.y)}function x(y,S){return y.x===S.x&&y.y===S.y}function w(y,S,P,T){var L=B(b(y,S,P)),I=B(b(y,S,T)),R=B(b(P,T,y)),U=B(b(P,T,S));return!!(L!==I&&R!==U||L===0&&C(y,P,S)||I===0&&C(y,T,S)||R===0&&C(P,y,T)||U===0&&C(P,S,T))}function C(y,S,P){return S.x<=Math.max(y.x,P.x)&&S.x>=Math.min(y.x,P.x)&&S.y<=Math.max(y.y,P.y)&&S.y>=Math.min(y.y,P.y)}function B(y){return y>0?1:y<0?-1:0}function F(y,S){var P=y;do{if(P.i!==y.i&&P.next.i!==y.i&&P.i!==S.i&&P.next.i!==S.i&&w(P,P.next,y,S))return!0;P=P.next}while(P!==y);return!1}function D(y,S){return b(y.prev,y,y.next)<0?b(y,S,y.next)>=0&&b(y,y.prev,S)>=0:b(y,S,y.prev)<0||b(y,y.next,S)<0}function k(y,S){var P=y,T=!1,L=(y.x+S.x)/2,I=(y.y+S.y)/2;do P.y>I!=P.next.y>I&&P.next.y!==P.y&&L<(P.next.x-P.x)*(I-P.y)/(P.next.y-P.y)+P.x&&(T=!T),P=P.next;while(P!==y);return T}function W(y,S){var P=new V(y.i,y.x,y.y),T=new V(S.i,S.x,S.y),L=y.next,I=S.prev;return y.next=S,S.prev=y,P.next=L,L.prev=P,T.next=P,P.prev=T,I.next=T,T.prev=I,T}function G(y,S,P,T){var L=new V(y,S,P);return T?(L.next=T.next,L.prev=T,T.next.prev=L,T.next=L):(L.prev=L,L.next=L),L}function z(y){y.next.prev=y.prev,y.prev.next=y.next,y.prevZ&&(y.prevZ.nextZ=y.nextZ),y.nextZ&&(y.nextZ.prevZ=y.prevZ)}function V(y,S,P){this.i=y,this.x=S,this.y=P,this.prev=null,this.next=null,this.z=0,this.prevZ=null,this.nextZ=null,this.steiner=!1}i.deviation=function(y,S,P,T){var L=S&&S.length,I=L?S[0]*P:y.length,R=Math.abs(J(y,0,I,P));if(L)for(var U=0,Y=S.length;U<Y;U++){var j=S[U]*P,ee=U<Y-1?S[U+1]*P:y.length;R-=Math.abs(J(y,j,ee,P))}var ae=0;for(U=0;U<T.length;U+=3){var ie=T[U]*P,be=T[U+1]*P,oe=T[U+2]*P;ae+=Math.abs((y[ie]-y[oe])*(y[be+1]-y[ie+1])-(y[ie]-y[be])*(y[oe+1]-y[ie+1]))}return R===0&&ae===0?0:Math.abs((ae-R)/R)};function J(y,S,P,T){for(var L=0,I=S,R=P-T;I<P;I+=T)L+=(y[R]-y[I])*(y[I+1]+y[R+1]),R=I;return L}return i.flatten=function(y){for(var S=y[0][0].length,P={vertices:[],holes:[],dimensions:S},T=0,L=0;L<y.length;L++){for(var I=0;I<y[L].length;I++)for(var R=0;R<S;R++)P.vertices.push(y[L][I][R]);L>0&&(T+=y[L-1].length,P.holes.push(T))}return P},ks.exports}var hO=dO();const gO=Cy(hO),Bs=Jm.CLOCKWISE,Ph=Jm.COUNTER_CLOCKWISE,zt={};function pO(i){if(i=i&&i.positions||i,!Array.isArray(i)&&!ArrayBuffer.isView(i))throw new Error("invalid polygon")}function Tn(i){return"positions"in i?i.positions:i}function Qs(i){return"holeIndices"in i?i.holeIndices:null}function mO(i){return Array.isArray(i[0])}function yO(i){return i.length>=1&&i[0].length>=2&&Number.isFinite(i[0][0])}function _O(i){const e=i[0],t=i[i.length-1];return e[0]===t[0]&&e[1]===t[1]&&e[2]===t[2]}function bO(i,e,t,n){for(let s=0;s<e;s++)if(i[t+s]!==i[n-e+s])return!1;return!0}function Sh(i,e,t,n,s){let r=e;const o=t.length;for(let a=0;a<o;a++)for(let c=0;c<n;c++)i[r++]=t[a][c]||0;if(!_O(t))for(let a=0;a<n;a++)i[r++]=t[0][a]||0;return zt.start=e,zt.end=r,zt.size=n,ey(i,s,zt),r}function Eh(i,e,t,n,s=0,r,o){r=r||t.length;const a=r-s;if(a<=0)return e;let c=e;for(let l=0;l<a;l++)i[c++]=t[s+l];if(!bO(t,n,s,r))for(let l=0;l<n;l++)i[c++]=t[s+l];return zt.start=e,zt.end=c,zt.size=n,ey(i,o,zt),c}function vO(i,e){pO(i);const t=[],n=[];if("positions"in i){const{positions:s,holeIndices:r}=i;if(r){let o=0;for(let a=0;a<=r.length;a++)o=Eh(t,o,s,e,r[a-1],r[a],a===0?Bs:Ph),n.push(o);return n.pop(),{positions:t,holeIndices:n}}i=s}if(!mO(i))return Eh(t,0,i,e,0,t.length,Bs),t;if(!yO(i)){let s=0;for(const[r,o]of i.entries())s=Sh(t,s,o,e,r===0?Bs:Ph),n.push(s);return n.pop(),{positions:t,holeIndices:n}}return Sh(t,0,i,e,Bs),t}function Ta(i,e,t){const n=i.length/3;let s=0;for(let r=0;r<n;r++){const o=(r+1)%n;s+=i[r*3+e]*i[o*3+t],s-=i[o*3+e]*i[r*3+t]}return Math.abs(s/2)}function Ch(i,e,t,n){const s=i.length/3;for(let r=0;r<s;r++){const o=r*3,a=i[o+0],c=i[o+1],l=i[o+2];i[o+e]=a,i[o+t]=c,i[o+n]=l}}function xO(i,e,t,n){let s=Qs(i);s&&(s=s.map(a=>a/e));let r=Tn(i);const o=n&&e===3;if(t){const a=r.length;r=r.slice();const c=[];for(let l=0;l<a;l+=e){c[0]=r[l],c[1]=r[l+1],o&&(c[2]=r[l+2]);const u=t(c);r[l]=u[0],r[l+1]=u[1],o&&(r[l+2]=u[2])}}if(o){const a=Ta(r,0,1),c=Ta(r,0,2),l=Ta(r,1,2);if(!a&&!c&&!l)return[];a>c&&a>l||(c>l?(t||(r=r.slice()),Ch(r,0,2,1)):(t||(r=r.slice()),Ch(r,2,0,1)))}return gO(r,s,e)}class wO extends Ym{constructor(e){const{fp64:t,IndexType:n=Uint32Array}=e;super({...e,attributes:{positions:{size:3,type:t?Float64Array:Float32Array},vertexValid:{type:Uint16Array,size:1},indices:{type:n,size:1}}})}get(e){const{attributes:t}=this;return e==="indices"?t.indices&&t.indices.subarray(0,this.vertexCount):t[e]}updateGeometry(e){super.updateGeometry(e);const t=this.buffers.indices;if(t)this.vertexCount=(t.value||t).length;else if(this.data&&!this.getGeometry)throw new Error("missing indices buffer")}normalizeGeometry(e){if(this.normalize){const t=vO(e,this.positionSize);return this.opts.resolution?iy(Tn(t),Qs(t),{size:this.positionSize,gridResolution:this.opts.resolution,edgeTypes:!0}):this.opts.wrapLongitude?QR(Tn(t),Qs(t),{size:this.positionSize,maxLatitude:86,edgeTypes:!0}):t}return e}getGeometrySize(e){if(Lh(e)){let t=0;for(const n of e)t+=this.getGeometrySize(n);return t}return Tn(e).length/this.positionSize}getGeometryFromBuffer(e){return this.normalize||!this.buffers.indices?super.getGeometryFromBuffer(e):null}updateGeometryAttributes(e,t){if(e&&Lh(e))for(const n of e){const s=this.getGeometrySize(n);t.geometrySize=s,this.updateGeometryAttributes(n,t),t.vertexStart+=s,t.indexStart=this.indexStarts[t.geometryIndex+1]}else{const n=e;this._updateIndices(n,t),this._updatePositions(n,t),this._updateVertexValid(n,t)}}_updateIndices(e,{geometryIndex:t,vertexStart:n,indexStart:s}){const{attributes:r,indexStarts:o,typedArrayManager:a}=this;let c=r.indices;if(!c||!e)return;let l=s;const u=xO(e,this.positionSize,this.opts.preproject,this.opts.full3d);c=a.allocate(c,s+u.length,{copy:!0});for(let f=0;f<u.length;f++)c[l++]=u[f]+n;o[t+1]=s+u.length,r.indices=c}_updatePositions(e,{vertexStart:t,geometrySize:n}){const{attributes:{positions:s},positionSize:r}=this;if(!s||!e)return;const o=Tn(e);for(let a=t,c=0;c<n;a++,c++){const l=o[c*r],u=o[c*r+1],f=r>2?o[c*r+2]:0;s[a*3]=l,s[a*3+1]=u,s[a*3+2]=f}}_updateVertexValid(e,{vertexStart:t,geometrySize:n}){const{positionSize:s}=this,r=this.attributes.vertexValid,o=e&&Qs(e);if(e&&e.edgeTypes?r.set(e.edgeTypes,t):r.fill(1,t,t+n),o)for(let a=0;a<o.length;a++)r[t+o[a]/s-1]=0;r[t+n-1]=0}}function Lh(i){return Array.isArray(i)&&i.length>0&&!Number.isFinite(i[0])}const PO=`struct SolidPolygonUniforms {
  extruded: f32,
  isWireframe: f32,
  elevationScale: f32,
};

@group(0) @binding(auto) var<uniform> solidPolygon: SolidPolygonUniforms;
`,Th=`layout(std140) uniform solidPolygonUniforms {
  bool extruded;
  bool isWireframe;
  float elevationScale;
} solidPolygon;
`,SO={name:"solidPolygon",source:PO,vs:Th,fs:Th,uniformTypes:{extruded:"f32",isWireframe:"f32",elevationScale:"f32"}},ay=`in vec4 fillColors;
in vec4 lineColors;
in float rowIndexes;
out vec4 vColor;
struct PolygonProps {
vec3 positions;
vec3 positions64Low;
vec3 normal;
float elevations;
};
vec3 project_offset_normal(vec3 vector) {
if (project.coordinateSystem == COORDINATE_SYSTEM_LNGLAT ||
project.coordinateSystem == COORDINATE_SYSTEM_LNGLAT_OFFSETS) {
return normalize(vector * project.commonUnitsPerWorldUnit);
}
return project_normal(vector);
}
void calculatePosition(PolygonProps props) {
vec3 pos = props.positions;
vec3 pos64Low = props.positions64Low;
vec3 normal = props.normal;
vec4 colors = solidPolygon.isWireframe ? lineColors : fillColors;
geometry.worldPosition = props.positions;
geometry.pickingColor = picking_getPickingColorFromIndex(rowIndexes);
if (solidPolygon.extruded) {
pos.z += props.elevations * solidPolygon.elevationScale;
}
gl_Position = project_position_to_clipspace(pos, pos64Low, vec3(0.), geometry.position);
DECKGL_FILTER_GL_POSITION(gl_Position, geometry);
if (solidPolygon.extruded) {
#ifdef IS_SIDE_VERTEX
normal = project_offset_normal(normal);
#else
normal = project_normal(normal);
#endif
geometry.normal = normal;
vec3 lightColor = lighting_getLightColor(colors.rgb, project.cameraPosition, geometry.position.xyz, geometry.normal);
vColor = vec4(lightColor, colors.a * layer.opacity);
} else {
vColor = vec4(colors.rgb, colors.a * layer.opacity);
}
DECKGL_FILTER_COLOR(vColor, geometry);
}
`,EO=`#version 300 es
#define SHADER_NAME solid-polygon-layer-vertex-shader
in vec3 vertexPositions;
in vec3 vertexPositions64Low;
in float elevations;
${ay}
void main(void) {
PolygonProps props;
props.positions = vertexPositions;
props.positions64Low = vertexPositions64Low;
props.elevations = elevations;
props.normal = vec3(0.0, 0.0, 1.0);
calculatePosition(props);
}
`,CO=`#version 300 es
#define SHADER_NAME solid-polygon-layer-vertex-shader-side
#define IS_SIDE_VERTEX
in vec2 positions;
in vec3 vertexPositions;
in vec3 nextVertexPositions;
in vec3 vertexPositions64Low;
in vec3 nextVertexPositions64Low;
in float elevations;
in float instanceVertexValid;
${ay}
void main(void) {
if(instanceVertexValid < 0.5){
gl_Position = vec4(0.);
return;
}
PolygonProps props;
vec3 pos;
vec3 pos64Low;
vec3 nextPos;
vec3 nextPos64Low;
#if RING_WINDING_ORDER_CW == 1
pos = vertexPositions;
pos64Low = vertexPositions64Low;
nextPos = nextVertexPositions;
nextPos64Low = nextVertexPositions64Low;
#else
pos = nextVertexPositions;
pos64Low = nextVertexPositions64Low;
nextPos = vertexPositions;
nextPos64Low = vertexPositions64Low;
#endif
props.positions = mix(pos, nextPos, positions.x);
props.positions64Low = mix(pos64Low, nextPos64Low, positions.x);
props.normal = vec3(
pos.y - nextPos.y + (pos64Low.y - nextPos64Low.y),
nextPos.x - pos.x + (nextPos64Low.x - pos64Low.x),
0.0);
props.elevations = elevations * positions.y;
calculatePosition(props);
}
`,LO=`#version 300 es
#define SHADER_NAME solid-polygon-layer-fragment-shader
precision highp float;
in vec4 vColor;
out vec4 fragColor;
void main(void) {
fragColor = vColor;
geometry.uv = vec2(0.);
DECKGL_FILTER_COLOR(fragColor, geometry);
}
`;function cy(){return`fn project_offset_normal(vector: vec3<f32>) -> vec3<f32> {
  if (project.coordinateSystem == COORDINATE_SYSTEM_LNGLAT ||
      project.coordinateSystem == COORDINATE_SYSTEM_LNGLAT_OFFSETS) {
    return normalize(vector * project.commonUnitsPerWorldUnit);
  }
  return project_normal(vector);
}

fn apply_polygon_color(
  colors: vec4<f32>,
  normal: vec3<f32>,
  position: vec4<f32>
) -> vec4<f32> {
  if (solidPolygon.extruded > 0.5) {
    let lightColor = lighting_getLightColor2(
      colors.rgb,
      project.cameraPosition,
      position.xyz,
      normal
    );
    return vec4<f32>(lightColor, colors.a * layer.opacity);
  }
  return vec4<f32>(colors.rgb, colors.a * layer.opacity);
}
`}function ly(){return`@fragment
fn fragmentMain(inp: Varyings) -> @location(0) vec4<f32> {
  geometry.uv = vec2<f32>(0.0, 0.0);

  clip_filterColor(inp.clipCoordinates);

  if (picking.isActive > 0.5) {
    if (!picking_isColorValid(inp.pickingColor)) {
      discard;
    }
    return vec4<f32>(inp.pickingColor, 1.0);
  }

  var fragColor = inp.vColor;

  if (picking.isHighlightActive > 0.5) {
    let highlightedObjectColor = picking_normalizeColor(picking.highlightedObjectColor);
    if (picking_isColorZero(abs(inp.pickingColor - highlightedObjectColor))) {
      let highLightAlpha = picking.highlightColor.a;
      let blendedAlpha = highLightAlpha + fragColor.a * (1.0 - highLightAlpha);
      if (blendedAlpha > 0.0) {
        let highLightRatio = highLightAlpha / blendedAlpha;
        fragColor = vec4<f32>(
          mix(fragColor.rgb, picking.highlightColor.rgb, highLightRatio),
          blendedAlpha
        );
      } else {
        fragColor = vec4<f32>(fragColor.rgb, 0.0);
      }
    }
  }

  return deckgl_premultiplied_alpha(fragColor);
}
`}function TO(){return`${cy()}

struct Attributes {
  @location(0) vertexPositions: vec3<f32>,
  @location(1) vertexPositions64Low: vec3<f32>,
  @location(2) elevations: f32,
  @location(3) fillColors: vec4<f32>,
  @location(4) lineColors: vec4<f32>,
  @location(5) rowIndexes: u32,
};

struct Varyings {
  @builtin(position) position: vec4<f32>,
  @location(0) vColor: vec4<f32>,
  @location(1) pickingColor: vec3<f32>,
  @location(2) clipCoordinates: vec2<f32>,
};

@vertex
fn vertexMain(attributes: Attributes) -> Varyings {
  var outp: Varyings;

  var pos = attributes.vertexPositions;
  if (solidPolygon.extruded > 0.5) {
    pos.z += attributes.elevations * solidPolygon.elevationScale;
  }

  geometry.worldPosition = attributes.vertexPositions;
  geometry.pickingColor = picking_getPickingColorFromIndex(attributes.rowIndexes);

  let projectedPosition = project_position_to_clipspace_and_commonspace(
    pos,
    attributes.vertexPositions64Low,
    vec3<f32>(0.0)
  );
  geometry.position = projectedPosition.commonPosition;
  outp.position = projectedPosition.clipPosition;

  let normal = project_normal(vec3<f32>(0.0, 0.0, 1.0));
  geometry.normal = normal;

  let colors = select(
    attributes.fillColors,
    attributes.lineColors,
    solidPolygon.isWireframe > 0.5
  );
  outp.vColor = apply_polygon_color(colors, normal, geometry.position);
  outp.pickingColor = geometry.pickingColor;

  outp.clipCoordinates = geometry.position.xy;
  clip_filterPosition(&outp.position, geometry.worldPosition.xy);

  return outp;
}

${ly()}
`}function AO(i){return`const RING_WINDING_ORDER_CW: bool = ${i?"true":"false"};

${cy()}

struct Attributes {
  @location(0) positions: vec2<f32>,
  @location(1) vertexPositions: vec3<f32>,
  @location(2) vertexPositions64Low: vec3<f32>,
  @location(3) nextVertexPositions: vec3<f32>,
  @location(4) nextVertexPositions64Low: vec3<f32>,
  @location(5) vertexValid: f32,
  @location(6) elevations: f32,
  @location(7) fillColors: vec4<f32>,
  @location(8) lineColors: vec4<f32>,
  @location(9) rowIndexes: u32,
};

struct Varyings {
  @builtin(position) position: vec4<f32>,
  @location(0) vColor: vec4<f32>,
  @location(1) pickingColor: vec3<f32>,
  @location(2) clipCoordinates: vec2<f32>,
};

@vertex
fn vertexMain(attributes: Attributes) -> Varyings {
  var outp: Varyings;
  outp.position = vec4<f32>(0.0);
  outp.vColor = vec4<f32>(0.0);
  outp.pickingColor = picking_getPickingColorFromIndex(attributes.rowIndexes);
  outp.clipCoordinates = vec2<f32>(0.0);

  if (attributes.vertexValid < 0.5) {
    return outp;
  }

  let pos = select(attributes.nextVertexPositions, attributes.vertexPositions, RING_WINDING_ORDER_CW);
  let pos64Low = select(
    attributes.nextVertexPositions64Low,
    attributes.vertexPositions64Low,
    RING_WINDING_ORDER_CW
  );
  let nextPos = select(attributes.vertexPositions, attributes.nextVertexPositions, RING_WINDING_ORDER_CW);
  let nextPos64Low = select(
    attributes.vertexPositions64Low,
    attributes.nextVertexPositions64Low,
    RING_WINDING_ORDER_CW
  );

  let position = mix(pos, nextPos, attributes.positions.x);
  let position64Low = mix(pos64Low, nextPos64Low, attributes.positions.x);

  var worldPosition = position;
  if (solidPolygon.extruded > 0.5) {
    worldPosition.z += attributes.elevations * attributes.positions.y * solidPolygon.elevationScale;
  }

  geometry.worldPosition = position;
  geometry.pickingColor = picking_getPickingColorFromIndex(attributes.rowIndexes);

  let projectedPosition = project_position_to_clipspace_and_commonspace(
    worldPosition,
    position64Low,
    vec3<f32>(0.0)
  );
  geometry.position = projectedPosition.commonPosition;
  outp.position = projectedPosition.clipPosition;

  let normal = project_offset_normal(vec3<f32>(
    pos.y - nextPos.y + (pos64Low.y - nextPos64Low.y),
    nextPos.x - pos.x + (nextPos64Low.x - pos64Low.x),
    0.0
  ));
  geometry.normal = normal;

  let colors = select(
    attributes.fillColors,
    attributes.lineColors,
    solidPolygon.isWireframe > 0.5
  );
  outp.vColor = apply_polygon_color(colors, normal, geometry.position);
  outp.pickingColor = geometry.pickingColor;

  outp.clipCoordinates = geometry.position.xy;
  clip_filterPosition(&outp.position, geometry.worldPosition.xy);

  return outp;
}

${ly()}
`}function MO(i,e){return i==="top"?TO():AO(e)}const Fr=[0,0,0,255],IO={filled:!0,extruded:!1,wireframe:!1,_normalize:!0,_windingOrder:"CW",_full3d:!1,elevationScale:{type:"number",min:0,value:1},getPolygon:{type:"accessor",value:i=>i.polygon},getElevation:{type:"accessor",value:1e3},getFillColor:{type:"accessor",value:Fr},getLineColor:{type:"accessor",value:Fr},material:!0},Ds={enter:(i,e)=>e.length?e.subarray(e.length-i.length):i};class su extends et{getShaders(e){const t=!this.props._normalize&&this.props._windingOrder==="CCW"?0:1;return super.getShaders({vs:e==="top"?EO:CO,fs:LO,source:MO(e,!!t),defines:{RING_WINDING_ORDER_CW:t},modules:[bi,_i,Mp,vi,SO,...this.context.device.type==="webgpu"?[nu]:[]]})}get wrapLongitude(){return!1}getBounds(){return this.getAttributeManager()?.getBounds(["vertexPositions"])}initializeState(){const{viewport:e}=this.context;let{coordinateSystem:t}=this.props;const{_full3d:n}=this.props;e.isGeospatial&&t==="default"&&(t="lnglat");let s;t==="lnglat"&&(n?s=e.projectPosition.bind(e):s=e.projectFlat.bind(e)),this.setState({numInstances:0,polygonTesselator:new wO({preproject:s,fp64:this.use64bitPositions(),IndexType:Uint32Array})});const r=this.getAttributeManager(),o=!0,a=this.context.device.type==="webgpu";r.add({indices:{size:1,isIndexed:!0,update:this.calculateIndices,noAlloc:o},vertexPositions:{size:3,type:"float64",stepMode:"dynamic",fp64:this.use64bitPositions(),transition:Ds,accessor:"getPolygon",update:this.calculatePositions,noAlloc:o,...a?{}:{shaderAttributes:{nextVertexPositions:{vertexOffset:1}}}},...a?{nextVertexPositions:{size:3,type:"float64",stepMode:"dynamic",fp64:this.use64bitPositions(),transition:!1,update:this.calculateNextPositions,noAlloc:o}}:{},[a?"vertexValid":"instanceVertexValid"]:{size:1,type:a?"float32":"uint16",stepMode:"instance",update:this.calculateVertexValid,noAlloc:o},elevations:{size:1,stepMode:"dynamic",transition:Ds,accessor:"getElevation",bufferGroup:"solid-polygon-instance-data"},fillColors:{size:this.props.colorFormat.length,type:"unorm8",stepMode:"dynamic",transition:Ds,accessor:"getFillColor",defaultValue:Fr,bufferGroup:"solid-polygon-instance-data"},lineColors:{size:this.props.colorFormat.length,type:"unorm8",stepMode:"dynamic",transition:Ds,accessor:"getLineColor",defaultValue:Fr,bufferGroup:"solid-polygon-instance-data"},rowIndexes:{size:1,type:"uint32",stepMode:"dynamic",accessor:(c,{index:l})=>c&&c.__source?c.__source.index:l,bufferGroup:"solid-polygon-instance-data"}})}getPickingInfo(e){const t=super.getPickingInfo(e),{index:n}=t,s=this.props.data;return s[0]&&s[0].__source&&(t.object=s.find(r=>r.__source.index===n)),t}disablePickingIndex(e){const t=this.props.data;if(t[0]&&t[0].__source)for(let n=0;n<t.length;n++)t[n].__source.index===e&&this._disablePickingIndex(n);else super.disablePickingIndex(e)}draw({uniforms:e}){const{extruded:t,filled:n,wireframe:s,elevationScale:r}=this.props,{topModel:o,sideModel:a,wireframeModel:c,polygonTesselator:l}=this.state,u={extruded:!!t,elevationScale:r,isWireframe:!1};c&&s&&(c.setInstanceCount(l.instanceCount-1),c.shaderInputs.setProps({solidPolygon:{...u,isWireframe:!0}}),c.draw(this.context.renderPass)),a&&n&&(a.setInstanceCount(l.instanceCount-1),a.shaderInputs.setProps({solidPolygon:u}),a.draw(this.context.renderPass)),o&&n&&(o.setVertexCount(l.vertexCount),o.shaderInputs.setProps({solidPolygon:u}),o.draw(this.context.renderPass))}updateState(e){super.updateState(e),this.updateGeometry(e);const{props:t,oldProps:n,changeFlags:s}=e,r=this.getAttributeManager();(s.extensionsChanged||t.filled!==n.filled||t.extruded!==n.extruded)&&(this.state.models?.forEach(a=>a.destroy()),this.setState(this._getModels()),r.invalidateAll())}updateGeometry({props:e,oldProps:t,changeFlags:n}){if(n.dataChanged||n.updateTriggersChanged&&(n.updateTriggersChanged.all||n.updateTriggersChanged.getPolygon)){const{polygonTesselator:r}=this.state,o=e.data.attributes||{};r.updateGeometry({data:e.data,normalize:e._normalize,geometryBuffer:o.getPolygon,buffers:this.context.device.type==="webgpu"?{...o}:o,getGeometry:e.getPolygon,positionFormat:e.positionFormat,wrapLongitude:e.wrapLongitude,resolution:this.context.viewport.resolution,fp64:this.use64bitPositions(),dataChanged:n.dataChanged,full3d:e._full3d}),this.setState({numInstances:r.instanceCount,startIndices:r.vertexStarts}),n.dataChanged||this.getAttributeManager().invalidateAll()}}_getModels(){const{id:e,filled:t,extruded:n}=this.props;let s,r,o;if(t){const a=this.getShaders("top");a.defines={...a.defines,NON_INSTANCED_MODEL:1};let c=this.getAttributeManager().getBufferLayouts({isInstanced:!1});this.context.device.type==="webgpu"&&(c=c.filter(l=>l.name!=="indices"&&l.name!=="vertexValid"&&l.name!=="instanceVertexValid"&&l.name!=="nextVertexPositions")),s=new ke(this.context.device,{...a,id:`${e}-top`,topology:"triangle-list",bufferLayout:c,isIndexed:!0,userData:{excludeAttributes:{vertexValid:!0,instanceVertexValid:!0,nextVertexPositions:!0}}})}if(n){let a=this.getAttributeManager().getBufferLayouts({isInstanced:!0});this.context.device.type==="webgpu"&&(a=a.filter(c=>c.name!=="indices")),r=new ke(this.context.device,{...this.getShaders("side"),id:`${e}-side`,bufferLayout:a,geometry:new ui({topology:"triangle-strip",attributes:{positions:{size:2,value:new Float32Array([1,0,0,0,1,1,0,1])}}}),isInstanced:!0,userData:{excludeAttributes:{indices:!0}}}),o=new ke(this.context.device,{...this.getShaders("side"),id:`${e}-wireframe`,bufferLayout:a,geometry:new ui({topology:"line-strip",attributes:{positions:{size:2,value:new Float32Array([1,0,0,0,0,1,1,1])}}}),isInstanced:!0,userData:{excludeAttributes:{indices:!0}}})}return{models:[r,o,s].filter(Boolean),topModel:s,sideModel:r,wireframeModel:o}}calculateIndices(e){const{polygonTesselator:t}=this.state;e.startIndices=t.indexStarts,e.value=t.get("indices")}calculatePositions(e){const{polygonTesselator:t}=this.state;e.startIndices=t.vertexStarts;const n=this.props.data.attributes?.getPolygon;if(this.context.device.type==="webgpu"&&ArrayBuffer.isView(n?.value)){const{value:s,size:r=3,offset:o=0,stride:a}=n,c=o/s.BYTES_PER_ELEMENT,l=a?a/s.BYTES_PER_ELEMENT:r,u=new Float64Array(t.instanceCount*3);for(let f=0;f<t.instanceCount;f++){const d=c+f*l,h=f*3;u[h]=s[d],u[h+1]=s[d+1],u[h+2]=r>2?s[d+2]:0}e.value=u;return}e.value=t.get("positions")}calculateVertexValid(e){const t=this.props.data.attributes?.instanceVertexValid?.value,n=this.context.device.type==="webgpu"&&t?t:this.state.polygonTesselator.get("vertexValid");e.value=this.context.device.type==="webgpu"&&n?Float32Array.from(n):n}calculateNextPositions(e){const{polygonTesselator:t}=this.state,n=this.getAttributeManager().getAttributes(),s=n.vertexPositions.value,r=this.props.data.attributes?.instanceVertexValid?.value||n.vertexValid?.value||t.get("vertexValid");if(e.startIndices=t.vertexStarts,!s){e.value=s;return}const o=s.length/3,a=new s.constructor(s.length);for(let c=0;c<o;c++){const l=c*3,u=r?.[c]&&c+1<o?l+3:l;for(let f=0;f<3;f++)a[l+f]=s[u+f]}e.value=a}}su.defaultProps=IO;su.layerName="SolidPolygonLayer";function RO({data:i,getIndex:e,dataRange:t,replace:n}){const{startRow:s=0,endRow:r=1/0}=t,o=i.length;let a=o,c=o;for(let d=0;d<o;d++){const h=e(i[d]);if(a>d&&h>=s&&(a=d),h>=r){c=d;break}}let l=a;const f=c-a!==n.length?i.slice(c):void 0;for(let d=0;d<n.length;d++)i[l++]=n[d];if(f){for(let d=0;d<f.length;d++)i[l++]=f[d];i.length=l}return{startRow:a,endRow:a+n.length}}function OO(i,e){if(!i)return null;const t="startIndices"in i?i.startIndices[e]:e,n=i.featureIds.value[t];return t!==-1?kO(i,n,t):null}function kO(i,e,t){const n={properties:{...i.properties[e]}};for(const s in i.numericProps)n.properties[s]=i.numericProps[s].value[t];return n}function BO(i){const e={points:null,lines:null,polygons:null};for(const t in e){const n=i[t].globalFeatureIds.value;e[t]=new Uint32Array(n)}return e}const Ah=`layout(std140) uniform sdfUniforms {
  float gamma;
  bool enabled;
  float buffer;
  float outlineBuffer;
  vec4 outlineColor;
} sdf;
`,DO={name:"sdf",vs:Ah,fs:Ah,uniformTypes:{gamma:"f32",enabled:"f32",buffer:"f32",outlineBuffer:"f32",outlineColor:"vec4<f32>"}},zn={none:0,start:1,center:2,end:3},FO=`layout(std140) uniform textUniforms {
  highp vec2 cutoffPixels;
  highp ivec2 align;
  highp float fontSize;
  bool flipY;
} text;

#define ALIGN_MODE_START ${zn.start}
#define ALIGN_MODE_CENTER ${zn.center}
#define ALIGN_MODE_END ${zn.end}
`,uy={name:"text",vs:FO,getUniforms:({contentCutoffPixels:i=[0,0],contentAlignHorizontal:e="none",contentAlignVertical:t="none",fontSize:n,viewport:s})=>({cutoffPixels:i,align:[zn[e],zn[t]],fontSize:n,flipY:s?.flipY??!1}),uniformTypes:{cutoffPixels:"vec2<f32>",align:"vec2<i32>",fontSize:"f32",flipY:"f32"}},zO=`#version 300 es
#define SHADER_NAME multi-icon-layer-vertex-shader
in vec2 positions;
in vec3 instancePositions;
in vec3 instancePositions64Low;
in float instanceSizes;
in float instanceAngles;
in vec4 instanceColors;
in float rowIndexes;
in vec4 instanceIconFrames;
in float instanceColorModes;
in vec2 instanceOffsets;
in vec2 instancePixelOffset;
in vec4 instanceClipRect;
out float vColorMode;
out vec4 vColor;
out vec2 vTextureCoords;
out vec2 uv;
vec2 rotate_by_angle(vec2 vertex, float angle) {
float angle_radian = angle * PI / 180.0;
float cos_angle = cos(angle_radian);
float sin_angle = sin(angle_radian);
mat2 rotationMatrix = mat2(cos_angle, -sin_angle, sin_angle, cos_angle);
return rotationMatrix * vertex;
}
float getPixelOffsetFromAlignment(float anchor, float extent, float clipStart, float clipEnd, int mode) {
if (clipEnd < clipStart) return 0.0;
if (mode == ALIGN_MODE_START) {
return max(- (anchor + clipStart), 0.0);
}
if (mode == ALIGN_MODE_CENTER) {
float _min = max(0., anchor + clipStart);
float _max = min(extent, anchor + clipEnd);
return _min < _max ? (_min + _max) / 2.0 - anchor : 0.0;
}
if (mode == ALIGN_MODE_END) {
return min(extent - (anchor + clipEnd), 0.);
}
return 0.0;
}
void main(void) {
geometry.worldPosition = instancePositions;
geometry.uv = positions;
geometry.pickingColor = picking_getPickingColorFromIndex(rowIndexes);
uv = positions;
vec2 iconSize = instanceIconFrames.zw;
float sizePixels = clamp(
project_size_to_pixel(instanceSizes * icon.sizeScale, icon.sizeUnits),
icon.sizeMinPixels, icon.sizeMaxPixels
);
float instanceScale = sizePixels / text.fontSize;
vec2 pixelOffset = positions / 2.0 * iconSize + instanceOffsets;
pixelOffset = rotate_by_angle(pixelOffset, instanceAngles) * instanceScale;
pixelOffset += instancePixelOffset;
pixelOffset.y *= -1.0;
vec2 anchorPosScreen;
if (icon.billboard)  {
gl_Position = project_position_to_clipspace(instancePositions, instancePositions64Low, vec3(0.0), geometry.position);
anchorPosScreen = gl_Position.xy / gl_Position.w;
DECKGL_FILTER_GL_POSITION(gl_Position, geometry);
vec3 offset = vec3(pixelOffset, 0.0);
DECKGL_FILTER_SIZE(offset, geometry);
gl_Position.xy += project_pixel_size_to_clipspace(offset.xy);
} else {
vec3 offset_common = vec3(project_pixel_size(pixelOffset), 0.0);
if (text.flipY) {
offset_common.y *= -1.;
}
DECKGL_FILTER_SIZE(offset_common, geometry);
vec4 anchorPos = project_position_to_clipspace(instancePositions, instancePositions64Low, vec3(0.0));
anchorPosScreen = anchorPos.xy / anchorPos.w;
gl_Position = project_position_to_clipspace(instancePositions, instancePositions64Low, offset_common, geometry.position);
DECKGL_FILTER_GL_POSITION(gl_Position, geometry);
}
anchorPosScreen = vec2(anchorPosScreen.x + 1.0, 1.0 - anchorPosScreen.y) / 2.0 * project.viewportSize / project.devicePixelRatio;
vec2 xy = project_size_to_pixel(instanceClipRect.xy);
vec2 wh = project_size_to_pixel(instanceClipRect.zw);
if (text.flipY) {
xy.y = -xy.y - wh.y;
}
if (text.align.x > 0 || text.align.y > 0) {
vec2 viewportPixels = project.viewportSize / project.devicePixelRatio;
vec2 scrollPixels = vec2(
getPixelOffsetFromAlignment(anchorPosScreen.x, viewportPixels.x, xy.x, xy.x + wh.x, text.align.x),
-getPixelOffsetFromAlignment(anchorPosScreen.y, viewportPixels.y, -xy.y - wh.y, -xy.y, text.align.y)
);
pixelOffset += scrollPixels;
gl_Position.xy += project_pixel_size_to_clipspace(scrollPixels);
}
if (instanceClipRect.z >= 0.) {
if (pixelOffset.x < xy.x || pixelOffset.x > xy.x + wh.x) {
gl_Position = vec4(0.0);
}
else if (text.cutoffPixels.x > 0.) {
float vpWidth = project.viewportSize.x / project.devicePixelRatio;
float l = max(anchorPosScreen.x + xy.x, 0.0);
float r = min(anchorPosScreen.x + xy.x + wh.x, vpWidth);
if (r - l < text.cutoffPixels.x) {
gl_Position = vec4(0.0);
}
}
}
if (instanceClipRect.w >= 0.) {
if (pixelOffset.y < xy.y || pixelOffset.y > xy.y + wh.y) {
gl_Position = vec4(0.0);
}
else if (text.cutoffPixels.y > 0.) {
float vpHeight = project.viewportSize.y / project.devicePixelRatio;
float t = max(anchorPosScreen.y - xy.y - wh.y, 0.0);
float b = min(anchorPosScreen.y - xy.y, vpHeight);
if (b - t < text.cutoffPixels.y) {
gl_Position = vec4(0.0);
}
}
}
vTextureCoords = mix(
instanceIconFrames.xy,
instanceIconFrames.xy + iconSize,
(positions.xy + 1.0) / 2.0
) / icon.iconsTextureDim;
vColor = instanceColors;
DECKGL_FILTER_COLOR(vColor, geometry);
vColorMode = instanceColorModes;
}
`,NO=`#version 300 es
#define SHADER_NAME multi-icon-layer-fragment-shader
precision highp float;
uniform sampler2D iconsTexture;
in vec4 vColor;
in vec2 vTextureCoords;
in vec2 uv;
out vec4 fragColor;
void main(void) {
geometry.uv = uv;
if (!bool(picking.isActive)) {
float alpha = texture(iconsTexture, vTextureCoords).a;
vec4 color = vColor;
if (sdf.enabled) {
float distance = alpha;
alpha = smoothstep(sdf.buffer - sdf.gamma, sdf.buffer + sdf.gamma, distance);
if (sdf.outlineBuffer > 0.0) {
float inFill = alpha;
float inBorder = smoothstep(sdf.outlineBuffer - sdf.gamma, sdf.outlineBuffer + sdf.gamma, distance);
color = mix(sdf.outlineColor, vColor, inFill);
alpha = inBorder;
}
}
float a = alpha * color.a;
if (a < icon.alphaCutoff) {
discard;
}
fragColor = vec4(color.rgb, a * layer.opacity);
}
DECKGL_FILTER_COLOR(fragColor, geometry);
}
`;function UO({collision:i=!1}={}){return`struct IconUniforms {
  sizeScale: f32,
  iconsTextureDim: vec2<f32>,
  sizeBasis: f32,
  sizeMinPixels: f32,
  sizeMaxPixels: f32,
  billboard: i32,
  sizeUnits: i32,
  alphaCutoff: f32
};

struct TextUniforms {
  cutoffPixels: vec2<f32>,
  align: vec2<i32>,
  fontSize: f32,
  flipY: f32
};

struct SdfUniforms {
  gamma: f32,
  enabled: f32,
  buffer: f32,
  outlineBuffer: f32,
  outlineColor: vec4<f32>
};

${i?`struct CollisionUniforms {
  sort: i32,
  enabled: i32
};
`:""}

const ALIGN_MODE_START: i32 = 1;
const ALIGN_MODE_CENTER: i32 = 2;
const ALIGN_MODE_END: i32 = 3;

@group(0) @binding(auto) var<uniform> icon: IconUniforms;
@group(0) @binding(auto) var<uniform> text: TextUniforms;
@group(0) @binding(auto) var<uniform> sdf: SdfUniforms;
${i?"@group(0) @binding(auto) var<uniform> collision: CollisionUniforms;":""}
@group(0) @binding(auto) var iconsTexture : texture_2d<f32>;
@group(0) @binding(auto) var iconsTextureSampler : sampler;
${i?`@group(0) @binding(auto) var collision_texture : texture_2d<f32>;
`:""}

fn rotate_by_angle(vertex: vec2<f32>, angle_deg: f32) -> vec2<f32> {
  let angle_radian = angle_deg * PI / 180.0;
  let c = cos(angle_radian);
  let s = sin(angle_radian);
  let rotation = mat2x2<f32>(vec2<f32>(c, -s), vec2<f32>(s, c));
  return rotation * vertex;
}

fn get_pixel_offset_from_alignment(
  anchor: f32,
  extent: f32,
  clipStart: f32,
  clipEnd: f32,
  mode: i32
) -> f32 {
  if (clipEnd < clipStart) {
    return 0.0;
  }
  if (mode == ALIGN_MODE_START) {
    return max(-(anchor + clipStart), 0.0);
  }
  if (mode == ALIGN_MODE_CENTER) {
    let minValue = max(0.0, anchor + clipStart);
    let maxValue = min(extent, anchor + clipEnd);
    if (minValue < maxValue) {
      return (minValue + maxValue) / 2.0 - anchor;
    }
    return 0.0;
  }
  if (mode == ALIGN_MODE_END) {
    return min(extent - (anchor + clipEnd), 0.0);
  }
  return 0.0;
}

${i?`fn collision_match(texCoords: vec2<f32>, pickingColor: vec3<f32>) -> f32 {
  let textureSize = vec2<i32>(textureDimensions(collision_texture));
  let pixelCoords = clamp(
    vec2<i32>(texCoords * vec2<f32>(textureSize)),
    vec2<i32>(0),
    textureSize - vec2<i32>(1)
  );
  let collisionPickingColor = textureLoad(collision_texture, pixelCoords, 0);
  let delta = dot(abs(collisionPickingColor.rgb - pickingColor), vec3<f32>(1.0));
  return step(delta, 0.001);
}

fn collision_is_visible(texCoords: vec2<f32>, pickingColor: vec3<f32>) -> f32 {
  if (collision.enabled == 0) {
    return 1.0;
  }

  var accumulator = 0.0;
  let stepSize = vec2<f32>(1.0) / project.viewportSize;

  for (var i: i32 = -2; i <= 2; i = i + 1) {
    for (var j: i32 = -2; j <= 2; j = j + 1) {
      let delta = vec2<f32>(f32(j), f32(i)) * stepSize;
      accumulator = accumulator + collision_match(texCoords + delta, pickingColor);
    }
  }

  return pow(accumulator / 25.0, 2.2);
}
`:""}

struct Attributes {
  @location(0) positions: vec2<f32>,

  @location(1) instancePositions: vec3<f32>,
  @location(2) instancePositions64Low: vec3<f32>,
  @location(3) instanceSizes: f32,
  @location(4) instanceAngles: f32,
  @location(5) instanceColors: vec4<f32>,
  @location(6) instanceIconFrames: vec4<f32>,
  @location(7) instanceColorModes: f32,
  @location(8) instanceOffsets: vec2<f32>,
  @location(9) instancePixelOffset: vec2<f32>,
  @location(10) rowIndexes: u32,
  @location(11) instanceClipRect: vec4<f32>,
  ${i?"@location(12) collisionPriorities: f32,":""}
};

struct Varyings {
  @builtin(position) position: vec4<f32>,

  @location(0) vColorMode: f32,
  @location(1) vColor: vec4<f32>,
  @location(2) vTextureCoords: vec2<f32>,
  @location(3) uv: vec2<f32>,
  @location(4) pickingColor: vec3<f32>,
};

@vertex
fn vertexMain(inp: Attributes) -> Varyings {
  geometry.worldPosition = inp.instancePositions;
  geometry.uv = inp.positions;
  geometry.pickingColor = picking_getPickingColorFromIndex(inp.rowIndexes);

  var outp: Varyings;
  outp.uv = inp.positions;

  let iconSize = inp.instanceIconFrames.zw;

  let sizePixels = clamp(
    project_unit_size_to_pixel(inp.instanceSizes * icon.sizeScale, icon.sizeUnits),
    icon.sizeMinPixels, icon.sizeMaxPixels
  );
  let instanceScale = sizePixels / text.fontSize;

  var pixelOffset = inp.positions / 2.0 * iconSize + inp.instanceOffsets;
  pixelOffset = rotate_by_angle(pixelOffset, inp.instanceAngles) * instanceScale;
  pixelOffset = pixelOffset + inp.instancePixelOffset;
  pixelOffset.y = pixelOffset.y * -1.0;

  var pos: vec4<f32>;
  var anchorPosScreen: vec2<f32>;
  if (icon.billboard != 0) {
    pos = project_position_to_clipspace(inp.instancePositions, inp.instancePositions64Low, vec3<f32>(0.0));
    anchorPosScreen = pos.xy / pos.w;

    let clipOffset = project_pixel_size_to_clipspace(pixelOffset);
    pos = vec4<f32>(pos.x + clipOffset.x, pos.y + clipOffset.y, pos.z, pos.w);
  } else {
    var offsetCommon = vec3<f32>(project_pixel_size_vec2(pixelOffset), 0.0);
    if (text.flipY > 0.5) {
      offsetCommon.y = offsetCommon.y * -1.0;
    }
    let anchorPos = project_position_to_clipspace(inp.instancePositions, inp.instancePositions64Low, vec3<f32>(0.0));
    anchorPosScreen = anchorPos.xy / anchorPos.w;
    pos = project_position_to_clipspace(inp.instancePositions, inp.instancePositions64Low, offsetCommon);
  }

  anchorPosScreen = vec2<f32>(anchorPosScreen.x + 1.0, 1.0 - anchorPosScreen.y) / 2.0 *
    project.viewportSize / project.devicePixelRatio;
  var xy = project_size_vec2(inp.instanceClipRect.xy) * project.scale;
  var wh = project_size_vec2(inp.instanceClipRect.zw) * project.scale;

  if (text.flipY > 0.5) {
    xy.y = -xy.y - wh.y;
  }
  if (text.align.x > 0 || text.align.y > 0) {
    let viewportPixels = project.viewportSize / project.devicePixelRatio;
    let scrollPixels = vec2<f32>(
      get_pixel_offset_from_alignment(anchorPosScreen.x, viewportPixels.x, xy.x, xy.x + wh.x, text.align.x),
      -get_pixel_offset_from_alignment(anchorPosScreen.y, viewportPixels.y, -xy.y - wh.y, -xy.y, text.align.y)
    );
    pixelOffset = pixelOffset + scrollPixels;
    let scrollClipOffset = project_pixel_size_to_clipspace(scrollPixels);
    pos.x = pos.x + scrollClipOffset.x;
    pos.y = pos.y + scrollClipOffset.y;
  }

  if (inp.instanceClipRect.z >= 0.0) {
    if (pixelOffset.x < xy.x || pixelOffset.x > xy.x + wh.x) {
      pos = vec4<f32>(0.0);
    } else if (text.cutoffPixels.x > 0.0) {
      let viewportWidth = project.viewportSize.x / project.devicePixelRatio;
      let left = max(anchorPosScreen.x + xy.x, 0.0);
      let right = min(anchorPosScreen.x + xy.x + wh.x, viewportWidth);
      if (right - left < text.cutoffPixels.x) {
        pos = vec4<f32>(0.0);
      }
    }
  }
  if (inp.instanceClipRect.w >= 0.0) {
    if (pixelOffset.y < xy.y || pixelOffset.y > xy.y + wh.y) {
      pos = vec4<f32>(0.0);
    } else if (text.cutoffPixels.y > 0.0) {
      let viewportHeight = project.viewportSize.y / project.devicePixelRatio;
      let top = max(anchorPosScreen.y - xy.y - wh.y, 0.0);
      let bottom = min(anchorPosScreen.y - xy.y, viewportHeight);
      if (bottom - top < text.cutoffPixels.y) {
        pos = vec4<f32>(0.0);
      }
    }
  }

  ${i?`  if (collision.sort != 0) {
    pos.z = -0.001 * inp.collisionPriorities * pos.w;
  }
  `:""}

  let uvMix = (inp.positions.xy + vec2<f32>(1.0, 1.0)) * 0.5;
  outp.vTextureCoords = mix(inp.instanceIconFrames.xy, inp.instanceIconFrames.xy + iconSize, uvMix) / icon.iconsTextureDim;

  outp.position = pos;
  outp.vColor = inp.instanceColors;
  outp.vColorMode = inp.instanceColorModes;
  outp.pickingColor = picking_getPickingColorFromIndex(inp.rowIndexes);

  return outp;
}

@fragment
fn fragmentMain(inp: Varyings) -> @location(0) vec4<f32> {
  geometry.uv = inp.uv;

  let texColor = textureSample(iconsTexture, iconsTextureSampler, inp.vTextureCoords);
  var alpha = texColor.a;
  var color = inp.vColor;

  if (sdf.enabled > 0.5) {
    let distance = alpha;
    alpha = smoothstep(sdf.buffer - sdf.gamma, sdf.buffer + sdf.gamma, distance);

    if (sdf.outlineBuffer > 0.0) {
      let inFill = alpha;
      let inBorder = smoothstep(sdf.outlineBuffer - sdf.gamma, sdf.outlineBuffer + sdf.gamma, distance);
      color = mix(sdf.outlineColor, inp.vColor, inFill);
      alpha = inBorder;
    }
  } else if (inp.vColorMode == 0.0) {
    color = texColor;
  }

  var a = alpha * color.a * layer.opacity;
  if (a < icon.alphaCutoff) {
    discard;
  }

  if (picking.isActive > 0.5) {
    if (!picking_isColorValid(inp.pickingColor)) {
      discard;
    }
    return vec4<f32>(inp.pickingColor, 1.0);
  }

  ${i?`  let collisionFade = collision_is_visible(inp.position.xy / project.viewportSize, inp.pickingColor);
  a = a * collisionFade;
  if (a <= 0.0001) {
    discard;
  }
  `:""}

  var fragColor = deckgl_premultiplied_alpha(vec4<f32>(color.rgb, a));

  if (picking.isHighlightActive > 0.5) {
    let highlightedObjectColor = picking_normalizeColor(picking.highlightedObjectColor);
    if (picking_isColorZero(abs(inp.pickingColor - highlightedObjectColor))) {
      let highLightAlpha = picking.highlightColor.a;
      let blendedAlpha = highLightAlpha + fragColor.a * (1.0 - highLightAlpha);
      if (blendedAlpha > 0.0) {
        let highLightRatio = highLightAlpha / blendedAlpha;
        fragColor = vec4<f32>(
          mix(fragColor.rgb, picking.highlightColor.rgb, highLightRatio),
          blendedAlpha
        );
      } else {
        fragColor = vec4<f32>(fragColor.rgb, 0.0);
      }
    }
  }

  return fragColor;
}
`}const $O=UO(),Aa=192/256,GO={getIconOffsets:{type:"accessor",value:i=>i.offsets},getContentBox:{type:"accessor",value:[0,0,-1,-1]},fontSize:1,alphaCutoff:.001,smoothing:.1,outlineWidth:0,outlineColor:{type:"color",value:[0,0,0,255]},contentCutoffPixels:{type:"array",value:[0,0]},contentAlignHorizontal:"none",contentAlignVertical:"none"};class ru extends Qi{getShaders(){const e=super.getShaders();return{...e,modules:[...e.modules,uy,DO],vs:zO,fs:NO,source:$O}}initializeState(){super.initializeState();const e=this.getAttributeManager(),t=e.attributes.instanceIconDefs;t.settings.update=this.calculateInstanceIconDefs,e.addInstanced({rowIndexes:{type:"uint32",size:1,bufferGroup:"icon-instance-data",accessor:(n,{index:s})=>s},instanceClipRect:{size:4,bufferGroup:"icon-instance-data",accessor:"getContentBox",defaultValue:[0,0,-1,-1]}})}updateState(e){super.updateState(e);const{props:t,oldProps:n,changeFlags:s}=e,{outlineColor:r}=t;if(s.extensionsChanged){this.state.fillModel?.destroy();const o=this.context.device.type==="webgpu"?this._getModel(`${this.props.id}-fill`):void 0;this.setState({fillModel:o,models:o?[this.state.model,o]:[this.state.model]})}if(s.updateTriggersChanged&&(s.updateTriggersChanged.getIcon||s.updateTriggersChanged.getIconOffsets)&&this.getAttributeManager().invalidate("instanceIconDefs"),r!==n.outlineColor){const o=[r[0]/255,r[1]/255,r[2]/255,(r[3]??255)/255];this.setState({outlineColor:o})}!t.sdf&&t.outlineWidth&&K.warn(`${this.id}: fontSettings.sdf is required to render outline`)()}draw(e){const{sdf:t,smoothing:n,fontSize:s,outlineWidth:r,contentCutoffPixels:o,contentAlignHorizontal:a,contentAlignVertical:c}=this.props,{outlineColor:l}=this.state,u=r?Math.max(n,Aa*(1-r)):-1,f=this.state.model,d={buffer:Aa,outlineBuffer:u,gamma:n,enabled:!!t,outlineColor:l},h={contentCutoffPixels:o,contentAlignHorizontal:a,contentAlignVertical:c,fontSize:s,viewport:this.context.viewport};if(f.shaderInputs.setProps({sdf:d,text:h}),super.draw(e),t&&r){const{iconManager:g}=this.state;if(g.getTexture()){const m=this.state.fillModel||f;m.shaderInputs.setProps({sdf:{...d,outlineBuffer:Aa},text:h}),this._drawModel(m)}}}calculateInstanceIconDefs(e,{startRow:t,endRow:n}){const{data:s,getIcon:r,getIconOffsets:o}=this.props;let a=e.getVertexOffset(t);const c=e.value,{iterable:l,objectInfo:u}=os(s,t,n);for(const f of l){u.index++;const d=r(f,u),h=o(f,u);if(d){let g=0;for(const p of Array.from(d)){const m=super.getInstanceIconDef(p);m[0]=h[g*2],m[1]+=h[g*2+1],m[6]=1,c.set(m,a),a+=e.size,g++}}}}}ru.defaultProps=GO;ru.layerName="MultiIconLayer";const Nn=1e20,ou=new Float64Array(256);for(let i=0;i<256;i++){const e=.5-Math.pow(i/255,.45454545454545453);ou[i]=e*Math.abs(e)}ou[255]=-Nn;class VO{constructor({fontSize:e=24,buffer:t=3,radius:n=8,cutoff:s=.25,fontFamily:r="sans-serif",fontWeight:o="normal",fontStyle:a="normal",lang:c=null}={}){this.buffer=t,this.radius=n,this.cutoff=s,this.lang=c;const l=this.size=e+t*4,u=this._createCanvas(l),f=this.ctx=u.getContext("2d",{willReadFrequently:!0});f.font=`${a} ${o} ${e}px ${r}`,f.textBaseline="alphabetic",f.textAlign="left",f.fillStyle="black",this.gridOuter=new Float64Array(l*l),this.gridInner=new Float64Array(l*l),this.f=new Float64Array(l),this.z=new Float64Array(l+1),this.v=new Uint16Array(l)}_createCanvas(e){if(typeof OffscreenCanvas<"u")return new OffscreenCanvas(e,e);const t=document.createElement("canvas");return t.width=t.height=e,t}draw(e){const{width:t,actualBoundingBoxAscent:n,actualBoundingBoxDescent:s,actualBoundingBoxLeft:r,actualBoundingBoxRight:o}=this.ctx.measureText(e),a=Math.ceil(n),c=Math.floor(-r),l=Math.max(0,Math.min(this.size-this.buffer,Math.ceil(o)-c)),u=Math.max(0,Math.min(this.size-this.buffer,a+Math.ceil(s))),f=l+2*this.buffer,d=u+2*this.buffer,h=Math.max(f*d,0),g=new Uint8ClampedArray(h),p={data:g,width:f,height:d,glyphWidth:l,glyphHeight:u,glyphTop:a,glyphLeft:c,glyphAdvance:t};if(l===0||u===0)return p;const{ctx:m,buffer:_,gridInner:v,gridOuter:b}=this;this.lang&&(m.lang=this.lang),m.clearRect(_,_,l,u),m.fillText(e,_-c,_+a);const x=m.getImageData(_,_,l,u);b.fill(Nn,0,h),v.fill(0,0,h);let w=3;for(let D=0;D<u;D++){let k=(D+_)*f+_;for(let W=0;W<l;W++,w+=4,k++){const G=x.data[w];if(G===0)continue;const z=ou[G];b[k]=Math.max(0,z),v[k]=Math.max(0,-z)}}Mh(b,0,0,f,d,f,this.f,this.v,this.z);const C=Math.min(_,1);Mh(v,_-C,_-C,l+2*C,u+2*C,f,this.f,this.v,this.z);const B=255/this.radius,F=255*(1-this.cutoff);for(let D=0;D<h;D++){const k=Math.sqrt(b[D])-Math.sqrt(v[D]);g[D]=Math.round(F-B*k)}return p}}function Mh(i,e,t,n,s,r,o,a,c){for(let l=e;l<e+n;l++)Ih(i,t*r+l,r,s,o,a,c);for(let l=t;l<t+s;l++)Ih(i,l*r+e,1,n,o,a,c)}function Ih(i,e,t,n,s,r,o){r[0]=0,o[0]=-Nn,o[1]=Nn,s[0]=i[e];for(let a=1,c=0,l=0;a<n;a++){s[a]=i[e+a*t];const u=a*a;do{const f=r[c];l=(s[a]-s[f]+u-f*f)/(a-f)/2}while(l<=o[c]&&--c>-1);c++,r[c]=a,o[c]=l,o[c+1]=Nn}for(let a=0,c=0;a<n;a++){for(;o[c+1]<a;)c++;const l=r[c],u=a-l;i[e+a*t]=s[l]+u*u}}const jO=32,WO=[];function HO(i){return Math.pow(2,Math.ceil(Math.log2(i)))}function YO({characterSet:i,measureText:e,buffer:t,maxCanvasWidth:n,mapping:s={},xOffset:r=0,yOffsetMin:o=0,yOffsetMax:a=0}){let c=r,l=o,u=a;for(const f of i)if(!s[f]){const{advance:d,width:h,ascent:g,descent:p}=e(f),m=g+p;c+h+t*2>n&&(c=0,l=u),s[f]={x:c+t,y:l+t,width:h,height:m,advance:d,anchorX:h/2,anchorY:g},c+=h+t*2,u=Math.max(u,l+m+t*2)}return{mapping:s,xOffset:c,yOffsetMin:l,yOffsetMax:u,canvasHeight:HO(u)}}function fy(i,e,t,n){let s=0;for(let r=e;r<t;r++){const o=i[r];s+=n[o]?.advance||0}return s}function dy(i,e,t,n,s,r){let o=e,a=0;for(let c=e;c<t;c++){const l=fy(i,c,c+1,s);a+l>n&&(o<c&&r.push(c),o=c,a=0),a+=l}return a}function qO(i,e,t,n,s,r){let o=e,a=e,c=e,l=0;for(let u=e;u<t;u++)if((i[u]===" "||i[u+1]===" "||u+1===t)&&(c=u+1),c>a){let f=fy(i,a,c,s);l+f>n&&(o<a&&(r.push(a),o=a,l=0),f>n&&(f=dy(i,a,c,n,s,r),o=r[r.length-1])),a=c,l+=f}return l}function ZO(i,e,t,n,s=0,r){r===void 0&&(r=i.length);const o=[];return e==="break-all"?dy(i,s,r,t,n,o):qO(i,s,r,t,n,o),o}function XO(i,e,t,n,s,r){let o=0,a=0;for(let c=e;c<t;c++){const l=i[c],u=n[l];u&&(a=Math.max(a,u.height))}for(let c=e;c<t;c++){const l=i[c],u=n[l];u?(s[c]=o+u.anchorX,o+=u.advance):(K.warn(`Missing character: ${l} (${l.codePointAt(0)})`)(),s[c]=o,o+=jO)}r[0]=o,r[1]=a}function KO(i,e,t,n,s,r){const o=Array.from(i),a=o.length,c=new Array(a),l=new Array(a),u=new Array(a),f=(n==="break-word"||n==="break-all")&&isFinite(s)&&s>0,d=[0,0],h=[0,0];let g=0,p=e+t/2,m=0,_=0;for(let v=0;v<=a;v++){const b=o[v];if((b===`
`||v===a)&&(_=v),_>m){const x=f?ZO(o,n,s,r,m,_):WO;for(let w=0;w<=x.length;w++){const C=w===0?m:x[w-1],B=w<x.length?x[w]:_;XO(o,C,B,r,c,h);for(let F=C;F<B;F++)l[F]=p,u[F]=h[0];g++,p+=t,d[0]=Math.max(d[0],h[0])}m=_}b===`
`&&(c[m]=0,l[m]=0,u[m]=0,m++)}return d[1]=g*t,{x:c,y:l,rowWidth:u,size:d}}function QO({value:i,length:e,stride:t,offset:n,startIndices:s,characterSet:r}){const o=i.BYTES_PER_ELEMENT,a=t?t/o:1,c=n?n/o:0,l=s[e]||Math.ceil((i.length-c)/a),u=r&&new Set,f=new Array(e);let d=i;if(a>1||c>0){const h=i.constructor;d=new h(l);for(let g=0;g<l;g++)d[g]=i[g*a+c]}for(let h=0;h<e;h++){const g=s[h],p=s[h+1]||l,m=d.subarray(g,p);f[h]=String.fromCodePoint.apply(null,m),u&&m.forEach(u.add,u)}if(u)for(const h of u)r.add(String.fromCodePoint(h));return{texts:f,characterCount:l}}class hy{constructor(e=5){this._cache={},this._order=[],this.limit=e}get(e){const t=this._cache[e];return t&&(this._deleteOrder(e),this._appendOrder(e)),t}set(e,t){this._cache[e]?(this.delete(e),this._cache[e]=t,this._appendOrder(e)):(Object.keys(this._cache).length===this.limit&&this.delete(this._order[0]),this._cache[e]=t,this._appendOrder(e))}delete(e){this._cache[e]&&(delete this._cache[e],this._deleteOrder(e))}_deleteOrder(e){const t=this._order.indexOf(e);t>=0&&this._order.splice(t,1)}_appendOrder(e){this._order.push(e)}}function JO(){const i=[];for(let e=32;e<128;e++)i.push(String.fromCharCode(e));return i}const ji={fontFamily:"Monaco, monospace",fontWeight:"normal",characterSet:JO(),fontSize:64,buffer:4,sdf:!1,cutoff:.25,radius:12,smoothing:.1},Rh=1024,Oh=.9,kh=.3,gy=3;let zr=new hy(gy);function ek(i,e){let t;typeof e=="string"?t=new Set(Array.from(e)):t=new Set(e);const n=zr.get(i);if(!n)return t;for(const s in n.mapping)t.has(s)&&t.delete(s);return t}function tk(i,e){for(let t=0;t<i.length;t++)e.data[4*t+3]=i[t]}function Bh(i,e,t,n){i.font=`${n} ${t}px ${e}`,i.fillStyle="#000",i.textBaseline="alphabetic",i.textAlign="left"}function ik(i,e,t){if(t===void 0){const s=i.measureText("A");return s.fontBoundingBoxAscent?{advance:0,width:0,ascent:Math.ceil(s.fontBoundingBoxAscent),descent:Math.ceil(s.fontBoundingBoxDescent)}:{advance:0,width:0,ascent:e*Oh,descent:e*kh}}const n=i.measureText(t);return n.actualBoundingBoxAscent?{advance:n.width,width:Math.ceil(n.actualBoundingBoxRight-n.actualBoundingBoxLeft),ascent:Math.ceil(n.actualBoundingBoxAscent),descent:Math.ceil(n.actualBoundingBoxDescent)}:{advance:n.width,width:n.width,ascent:e*Oh,descent:e*kh}}function nk(i){K.assert(Number.isFinite(i)&&i>=gy,"Invalid cache limit"),zr=new hy(i)}class sk{constructor(){this.props={...ji}}get atlas(){return this._atlas}get mapping(){return this._atlas&&this._atlas.mapping}setProps(e={}){Object.assign(this.props,e),e._getFontRenderer&&(this._getFontRenderer=e._getFontRenderer),this._key=this._getKey();const t=ek(this._key,this.props.characterSet),n=zr.get(this._key);if(n&&t.size===0){this._atlas!==n&&(this._atlas=n);return}const s=this._generateFontAtlas(t,n);this._atlas=s,zr.set(this._key,s)}_generateFontAtlas(e,t){const{fontFamily:n,fontWeight:s,fontSize:r,buffer:o,sdf:a,radius:c,cutoff:l}=this.props;let u=t&&t.data;u||(u=document.createElement("canvas"),u.width=Rh);const f=u.getContext("2d",{willReadFrequently:!0});Bh(f,n,r,s);const d=x=>ik(f,r,x);let h;this._getFontRenderer?h=this._getFontRenderer(this.props):a&&(h={measure:d,draw:rk(this.props)});const{mapping:g,canvasHeight:p,xOffset:m,yOffsetMin:_,yOffsetMax:v}=YO({measureText:x=>h?h.measure(x):d(x),buffer:o,characterSet:e,maxCanvasWidth:Rh,...t&&{mapping:t.mapping,xOffset:t.xOffset,yOffsetMin:t.yOffsetMin,yOffsetMax:t.yOffsetMax}});if(u.height!==p){const x=u.height>0?f.getImageData(0,0,u.width,u.height):null;u.height=p,x&&f.putImageData(x,0,0)}if(Bh(f,n,r,s),h)for(const x of e){const w=g[x],C=w.width,{data:B,left:F=0,top:D=0}=h.draw(x),k=w.x-F,W=w.y-D,G=Math.max(0,Math.round(k)),z=Math.max(0,Math.round(W)),V=Math.min(B.width,u.width-G),J=Math.min(B.height,u.height-z);f.putImageData(B,G,z,0,0,V,J),w.x=G,w.y=z,w.width=V,w.height=J,w.anchorX+=V/2-F-C/2,w.anchorY+=D}else for(const x of e){const w=g[x];f.fillText(x,w.x,w.y+w.anchorY)}const b=h?h.measure():d();return{baselineOffset:(b.ascent-b.descent)/2,xOffset:m,yOffsetMin:_,yOffsetMax:v,mapping:g,data:u,width:u.width,height:u.height}}_getKey(){const{fontFamily:e,fontWeight:t,fontSize:n,buffer:s,sdf:r,radius:o,cutoff:a}=this.props;return r?`${e} ${t} ${n} ${s} ${o} ${a}`:`${e} ${t} ${n} ${s}`}}function rk({fontSize:i,buffer:e,radius:t,cutoff:n,fontFamily:s,fontWeight:r}){const o=new VO({fontSize:i,buffer:e,radius:t,cutoff:n,fontFamily:s,fontWeight:`${r}`});return a=>{const{data:c,width:l,height:u}=o.draw(a),f=new ImageData(l,u);return tk(c,f),{data:f,left:e,top:e}}}const ok=`struct TextBackgroundUniforms {
  billboard: f32,
  sizeScale: f32,
  sizeMinPixels: f32,
  sizeMaxPixels: f32,
  borderRadius: vec4<f32>,
  padding: vec4<f32>,
  sizeUnits: i32,
  stroked: f32,
};

@group(0) @binding(auto) var<uniform> textBackground: TextBackgroundUniforms;
`,Dh=`layout(std140) uniform textBackgroundUniforms {
  bool billboard;
  float sizeScale;
  float sizeMinPixels;
  float sizeMaxPixels;
  vec4 borderRadius;
  vec4 padding;
  highp int sizeUnits;
  bool stroked;
} textBackground;
`,ak={name:"textBackground",source:ok,vs:Dh,fs:Dh,uniformTypes:{billboard:"f32",sizeScale:"f32",sizeMinPixels:"f32",sizeMaxPixels:"f32",borderRadius:"vec4<f32>",padding:"vec4<f32>",sizeUnits:"i32",stroked:"f32"}},ck=`#version 300 es
#define SHADER_NAME text-background-layer-vertex-shader
in vec2 positions;
in vec3 instancePositions;
in vec3 instancePositions64Low;
in vec4 instanceRects;
in vec4 instanceClipRect;
in float instanceSizes;
in float instanceAngles;
in vec2 instancePixelOffsets;
in float instanceLineWidths;
in vec4 instanceFillColors;
in vec4 instanceLineColors;
out vec4 vFillColor;
out vec4 vLineColor;
out float vLineWidth;
out vec2 uv;
out vec2 dimensions;
vec2 rotate_by_angle(vec2 vertex, float angle) {
float angle_radian = radians(angle);
float cos_angle = cos(angle_radian);
float sin_angle = sin(angle_radian);
mat2 rotationMatrix = mat2(cos_angle, -sin_angle, sin_angle, cos_angle);
return rotationMatrix * vertex;
}
void main(void) {
geometry.worldPosition = instancePositions;
geometry.uv = positions;
geometry.pickingColor = picking_getPickingColorFromInstanceID();
uv = positions;
vLineWidth = instanceLineWidths;
float sizePixels = clamp(
project_size_to_pixel(instanceSizes * textBackground.sizeScale, textBackground.sizeUnits),
textBackground.sizeMinPixels, textBackground.sizeMaxPixels
);
float instanceScale = sizePixels / text.fontSize;
dimensions = instanceRects.zw * instanceScale + textBackground.padding.xy + textBackground.padding.zw;
vec2 pixelOffset = (positions * instanceRects.zw + instanceRects.xy) * instanceScale + mix(-textBackground.padding.xy, textBackground.padding.zw, positions);
pixelOffset = rotate_by_angle(pixelOffset, instanceAngles);
pixelOffset += instancePixelOffsets;
pixelOffset.y *= -1.0;
vec2 xy = project_size_to_pixel(instanceClipRect.xy);
vec2 wh = project_size_to_pixel(instanceClipRect.zw);
if (text.flipY) {
xy.y = -xy.y - wh.y;
}
if (instanceClipRect.z >= 0.0) {
dimensions.x = wh.x;
pixelOffset.x = xy.x + uv.x * wh.x + mix(-textBackground.padding.x, textBackground.padding.z, uv.x);
}
if (instanceClipRect.w >= 0.0) {
dimensions.y = wh.y;
pixelOffset.y = xy.y + uv.y * wh.y + mix(-textBackground.padding.y, textBackground.padding.w, uv.y);
}
if (textBackground.billboard)  {
gl_Position = project_position_to_clipspace(instancePositions, instancePositions64Low, vec3(0.0), geometry.position);
DECKGL_FILTER_GL_POSITION(gl_Position, geometry);
vec3 offset = vec3(pixelOffset, 0.0);
DECKGL_FILTER_SIZE(offset, geometry);
gl_Position.xy += project_pixel_size_to_clipspace(offset.xy);
} else {
vec3 offset_common = vec3(project_pixel_size(pixelOffset), 0.0);
if (text.flipY) {
offset_common.y *= -1.;
}
DECKGL_FILTER_SIZE(offset_common, geometry);
gl_Position = project_position_to_clipspace(instancePositions, instancePositions64Low, offset_common, geometry.position);
DECKGL_FILTER_GL_POSITION(gl_Position, geometry);
}
vFillColor = vec4(instanceFillColors.rgb, instanceFillColors.a * layer.opacity);
DECKGL_FILTER_COLOR(vFillColor, geometry);
vLineColor = vec4(instanceLineColors.rgb, instanceLineColors.a * layer.opacity);
DECKGL_FILTER_COLOR(vLineColor, geometry);
}
`,lk=`#version 300 es
#define SHADER_NAME text-background-layer-fragment-shader
precision highp float;
in vec4 vFillColor;
in vec4 vLineColor;
in float vLineWidth;
in vec2 uv;
in vec2 dimensions;
out vec4 fragColor;
float round_rect(vec2 p, vec2 size, vec4 radii) {
vec2 pixelPositionCB = (p - 0.5) * size;
vec2 sizeCB = size * 0.5;
float maxBorderRadius = min(size.x, size.y) * 0.5;
vec4 borderRadius = vec4(min(radii, maxBorderRadius));
borderRadius.xy =
(pixelPositionCB.x > 0.0) ? borderRadius.xy : borderRadius.zw;
borderRadius.x = (pixelPositionCB.y > 0.0) ? borderRadius.x : borderRadius.y;
vec2 q = abs(pixelPositionCB) - sizeCB + borderRadius.x;
return -(min(max(q.x, q.y), 0.0) + length(max(q, 0.0)) - borderRadius.x);
}
float rect(vec2 p, vec2 size) {
vec2 pixelPosition = p * size;
return min(min(pixelPosition.x, size.x - pixelPosition.x),
min(pixelPosition.y, size.y - pixelPosition.y));
}
vec4 get_stroked_fragColor(float dist) {
float isBorder = smoothedge(dist, vLineWidth);
return mix(vFillColor, vLineColor, isBorder);
}
void main(void) {
geometry.uv = uv;
if (textBackground.borderRadius != vec4(0.0)) {
float distToEdge = round_rect(uv, dimensions, textBackground.borderRadius);
float shapeAlpha = smoothedge(-distToEdge, 0.0);
if (shapeAlpha == 0.0) {
discard;
}
if (textBackground.stroked) {
fragColor = get_stroked_fragColor(distToEdge);
} else {
fragColor = vFillColor;
}
fragColor.a *= shapeAlpha;
} else {
if (textBackground.stroked) {
float distToEdge = rect(uv, dimensions);
fragColor = get_stroked_fragColor(distToEdge);
} else {
fragColor = vFillColor;
}
}
DECKGL_FILTER_COLOR(fragColor, geometry);
}
`,uk=`struct TextUniforms {
  cutoffPixels: vec2<f32>,
  align: vec2<i32>,
  fontSize: f32,
  flipY: f32,
};

@group(0) @binding(auto) var<uniform> text: TextUniforms;

fn rotate_by_angle(vertex: vec2<f32>, angle: f32) -> vec2<f32> {
  let angleRadian = radians(angle);
  let cosine = cos(angleRadian);
  let sine = sin(angleRadian);
  let rotationMatrix = mat2x2<f32>(
    vec2<f32>(cosine, -sine),
    vec2<f32>(sine, cosine)
  );
  return rotationMatrix * vertex;
}

struct Attributes {
  @builtin(instance_index) instanceIndex: u32,
  @location(0) positions: vec2<f32>,
  @location(1) instancePositions: vec3<f32>,
  @location(2) instancePositions64Low: vec3<f32>,
  @location(3) instanceSizes: f32,
  @location(4) instanceAngles: f32,
  @location(5) instanceRects: vec4<f32>,
  @location(6) instanceClipRect: vec4<f32>,
  @location(7) instancePixelOffsets: vec2<f32>,
  @location(8) instanceFillColors: vec4<f32>,
  @location(9) instanceLineColors: vec4<f32>,
  @location(10) instanceLineWidths: f32,
};

struct Varyings {
  @builtin(position) position: vec4<f32>,
  @location(0) vFillColor: vec4<f32>,
  @location(1) vLineColor: vec4<f32>,
  @location(2) vLineWidth: f32,
  @location(3) uv: vec2<f32>,
  @location(4) dimensions: vec2<f32>,
  @location(5) pickingColor: vec3<f32>,
};

@vertex
fn vertexMain(attributes: Attributes) -> Varyings {
  geometry.worldPosition = attributes.instancePositions;
  geometry.uv = attributes.positions;
  geometry.pickingColor = picking_getPickingColorFromIndex(attributes.instanceIndex);

  var varyings: Varyings;
  varyings.uv = attributes.positions;
  varyings.vLineWidth = attributes.instanceLineWidths;

  let sizePixels = clamp(
    project_unit_size_to_pixel(
      attributes.instanceSizes * textBackground.sizeScale,
      textBackground.sizeUnits
    ),
    textBackground.sizeMinPixels,
    textBackground.sizeMaxPixels
  );
  let instanceScale = sizePixels / text.fontSize;

  varyings.dimensions = attributes.instanceRects.zw * instanceScale +
    textBackground.padding.xy + textBackground.padding.zw;

  var pixelOffset =
    (attributes.positions * attributes.instanceRects.zw + attributes.instanceRects.xy) *
      instanceScale +
    mix(-textBackground.padding.xy, textBackground.padding.zw, attributes.positions);
  pixelOffset = rotate_by_angle(pixelOffset, attributes.instanceAngles);
  pixelOffset = pixelOffset + attributes.instancePixelOffsets;
  pixelOffset.y = pixelOffset.y * -1.0;

  var xy = project_size_vec2(attributes.instanceClipRect.xy) * project.scale;
  let wh = project_size_vec2(attributes.instanceClipRect.zw) * project.scale;
  if (text.flipY > 0.5) {
    xy.y = -xy.y - wh.y;
  }
  if (attributes.instanceClipRect.z >= 0.0) {
    varyings.dimensions.x = wh.x;
    pixelOffset.x = xy.x + varyings.uv.x * wh.x + mix(
      -textBackground.padding.x,
      textBackground.padding.z,
      varyings.uv.x
    );
  }
  if (attributes.instanceClipRect.w >= 0.0) {
    varyings.dimensions.y = wh.y;
    pixelOffset.y = xy.y + varyings.uv.y * wh.y + mix(
      -textBackground.padding.y,
      textBackground.padding.w,
      varyings.uv.y
    );
  }

  if (textBackground.billboard > 0.5) {
    var position = project_position_to_clipspace(
      attributes.instancePositions,
      attributes.instancePositions64Low,
      vec3<f32>(0.0)
    );
    let clipOffset = project_pixel_size_to_clipspace(pixelOffset);
    position = vec4<f32>(
      position.x + clipOffset.x,
      position.y + clipOffset.y,
      position.z,
      position.w
    );
    varyings.position = position;
  } else {
    var offsetCommon = vec3<f32>(project_pixel_size_vec2(pixelOffset), 0.0);
    if (text.flipY > 0.5) {
      offsetCommon.y = offsetCommon.y * -1.0;
    }
    varyings.position = project_position_to_clipspace(
      attributes.instancePositions,
      attributes.instancePositions64Low,
      offsetCommon
    );
  }

  varyings.vFillColor = vec4<f32>(
    attributes.instanceFillColors.rgb,
    attributes.instanceFillColors.a * layer.opacity
  );
  varyings.vLineColor = vec4<f32>(
    attributes.instanceLineColors.rgb,
    attributes.instanceLineColors.a * layer.opacity
  );
  varyings.pickingColor = geometry.pickingColor;
  return varyings;
}

fn round_rect(point: vec2<f32>, size: vec2<f32>, radii: vec4<f32>) -> f32 {
  let pixelPosition = (point - 0.5) * size;
  let halfSize = size * 0.5;
  let maxBorderRadius = min(size.x, size.y) * 0.5;
  var borderRadius = min(radii, vec4<f32>(maxBorderRadius));

  borderRadius = select(borderRadius.zwxy, borderRadius, pixelPosition.x > 0.0);
  let radius = select(borderRadius.y, borderRadius.x, pixelPosition.y > 0.0);
  let q = abs(pixelPosition) - halfSize + radius;
  return -(min(max(q.x, q.y), 0.0) + length(max(q, vec2<f32>(0.0))) - radius);
}

fn rect(point: vec2<f32>, size: vec2<f32>) -> f32 {
  let pixelPosition = point * size;
  return min(
    min(pixelPosition.x, size.x - pixelPosition.x),
    min(pixelPosition.y, size.y - pixelPosition.y)
  );
}

fn get_stroked_frag_color(
  distanceToEdge: f32,
  lineWidth: f32,
  fillColor: vec4<f32>,
  lineColor: vec4<f32>
) -> vec4<f32> {
  let isBorder = smoothedge(distanceToEdge, lineWidth);
  return mix(fillColor, lineColor, isBorder);
}

@fragment
fn fragmentMain(varyings: Varyings) -> @location(0) vec4<f32> {
  geometry.uv = varyings.uv;
  var fragColor: vec4<f32>;

  if (any(textBackground.borderRadius != vec4<f32>(0.0))) {
    let distanceToEdge = round_rect(
      varyings.uv,
      varyings.dimensions,
      textBackground.borderRadius
    );
    let shapeAlpha = smoothedge(-distanceToEdge, 0.0);
    if (shapeAlpha == 0.0) {
      discard;
    }
    if (textBackground.stroked > 0.5) {
      fragColor = get_stroked_frag_color(
        distanceToEdge,
        varyings.vLineWidth,
        varyings.vFillColor,
        varyings.vLineColor
      );
    } else {
      fragColor = varyings.vFillColor;
    }
    fragColor.a = fragColor.a * shapeAlpha;
  } else if (textBackground.stroked > 0.5) {
    let distanceToEdge = rect(varyings.uv, varyings.dimensions);
    fragColor = get_stroked_frag_color(
      distanceToEdge,
      varyings.vLineWidth,
      varyings.vFillColor,
      varyings.vLineColor
    );
  } else {
    fragColor = varyings.vFillColor;
  }

  if (picking.isActive > 0.5) {
    if (!picking_isColorValid(varyings.pickingColor)) {
      discard;
    }
    return vec4<f32>(varyings.pickingColor, 1.0);
  }

  if (picking.isHighlightActive > 0.5) {
    let highlightedObjectColor = picking_normalizeColor(picking.highlightedObjectColor);
    if (picking_isColorZero(abs(varyings.pickingColor - highlightedObjectColor))) {
      let highlightAlpha = picking.highlightColor.a;
      let blendedAlpha = highlightAlpha + fragColor.a * (1.0 - highlightAlpha);
      if (blendedAlpha > 0.0) {
        let highlightRatio = highlightAlpha / blendedAlpha;
        fragColor = vec4<f32>(
          mix(fragColor.rgb, picking.highlightColor.rgb, highlightRatio),
          blendedAlpha
        );
      } else {
        fragColor = vec4<f32>(fragColor.rgb, 0.0);
      }
    }
  }

  return deckgl_premultiplied_alpha(fragColor);
}
`,fk={billboard:!0,sizeScale:1,sizeUnits:"pixels",sizeMinPixels:0,sizeMaxPixels:Number.MAX_SAFE_INTEGER,fontSize:1,borderRadius:{type:"object",value:0},padding:{type:"array",value:[0,0,0,0]},getPosition:{type:"accessor",value:i=>i.position},getSize:{type:"accessor",value:1},getAngle:{type:"accessor",value:0},getPixelOffset:{type:"accessor",value:[0,0]},getBoundingRect:{type:"accessor",value:[0,0,0,0]},getClipRect:{type:"accessor",value:[0,0,-1,-1]},getFillColor:{type:"accessor",value:[0,0,0,255]},getLineColor:{type:"accessor",value:[0,0,0,255]},getLineWidth:{type:"accessor",value:1}};class au extends et{getShaders(){return super.getShaders({vs:ck,fs:lk,source:uk,modules:[bi,_i,vi,ak,uy]})}initializeState(){this.getAttributeManager().addInstanced({instancePositions:{size:3,type:"float64",fp64:this.use64bitPositions(),transition:!0,accessor:"getPosition"},instanceSizes:{size:1,transition:!0,bufferGroup:"text-background-instance-data",accessor:"getSize",defaultValue:1},instanceAngles:{size:1,transition:!0,bufferGroup:"text-background-instance-data",accessor:"getAngle"},instanceRects:{size:4,bufferGroup:"text-background-instance-data",accessor:"getBoundingRect"},instanceClipRect:{size:4,bufferGroup:"text-background-instance-data",accessor:"getClipRect",defaultValue:[0,0,-1,-1]},instancePixelOffsets:{size:2,transition:!0,bufferGroup:"text-background-instance-data",accessor:"getPixelOffset"},instanceFillColors:{size:4,transition:!0,type:"unorm8",accessor:"getFillColor",defaultValue:[0,0,0,255]},instanceLineColors:{size:4,transition:!0,type:"unorm8",accessor:"getLineColor",defaultValue:[0,0,0,255]},instanceLineWidths:{size:1,transition:!0,bufferGroup:"text-background-instance-data",accessor:"getLineWidth",defaultValue:1}})}updateState(e){super.updateState(e);const{changeFlags:t}=e;t.extensionsChanged&&(this.state.model?.destroy(),this.state.model=this._getModel(),this.getAttributeManager().invalidateAll())}draw({uniforms:e}){const{billboard:t,sizeScale:n,sizeUnits:s,sizeMinPixels:r,sizeMaxPixels:o,getLineWidth:a,fontSize:c}=this.props;let{padding:l,borderRadius:u}=this.props;l.length<4&&(l=[l[0],l[1],l[0],l[1]]),Array.isArray(u)||(u=[u,u,u,u]);const f=this.state.model,d={billboard:t,stroked:!!a,borderRadius:u,padding:l,sizeUnits:_t[s],sizeScale:n,sizeMinPixels:r,sizeMaxPixels:o},h={fontSize:c,viewport:this.context.viewport};f.shaderInputs.setProps({textBackground:d,text:h}),f.draw(this.context.renderPass)}_getModel(){const e=[0,0,1,0,0,1,1,1];return new ke(this.context.device,{...this.getShaders(),id:this.props.id,bufferLayout:this.getAttributeManager().getBufferLayouts(),geometry:new ui({topology:"triangle-strip",vertexCount:4,attributes:{positions:{size:2,value:new Float32Array(e)}}}),isInstanced:!0})}}au.defaultProps=fk;au.layerName="TextBackgroundLayer";const Fh={start:1,middle:0,end:-1},zh={top:1,center:0,bottom:-1},Ma=[0,0,0,255],dk=1,hk={billboard:!0,sizeScale:1,sizeUnits:"pixels",sizeMinPixels:0,sizeMaxPixels:Number.MAX_SAFE_INTEGER,background:!1,getBackgroundColor:{type:"accessor",value:[255,255,255,255]},getBorderColor:{type:"accessor",value:Ma},getBorderWidth:{type:"accessor",value:0},backgroundBorderRadius:{type:"object",value:0},backgroundPadding:{type:"array",value:[0,0,0,0]},characterSet:{type:"object",value:ji.characterSet},fontFamily:ji.fontFamily,fontWeight:ji.fontWeight,lineHeight:dk,outlineWidth:{type:"number",value:0,min:0},outlineColor:{type:"color",value:Ma},fontSettings:{type:"object",value:{},compare:1},wordBreak:"break-word",maxWidth:{type:"number",value:-1},contentCutoffPixels:{type:"array",value:[0,0]},contentAlignHorizontal:"none",contentAlignVertical:"none",getText:{type:"accessor",value:i=>i.text},getPosition:{type:"accessor",value:i=>i.position},getColor:{type:"accessor",value:Ma},getSize:{type:"accessor",value:32},getAngle:{type:"accessor",value:0},getTextAnchor:{type:"accessor",value:"middle"},getAlignmentBaseline:{type:"accessor",value:"center"},getPixelOffset:{type:"accessor",value:[0,0]},getContentBox:{type:"accessor",value:[0,0,-1,-1]},backgroundColor:{deprecatedFor:["background","getBackgroundColor"]}};class cu extends Ql{constructor(){super(...arguments),this.getBoundingRect=(e,t)=>{const{size:[n,s]}=this.transformParagraph(e,t),{getTextAnchor:r,getAlignmentBaseline:o}=this.props,a=Fh[typeof r=="function"?r(e,t):r],c=zh[typeof o=="function"?o(e,t):o];return[(a-1)*n/2,(c-1)*s/2,n,s]},this.getIconOffsets=(e,t)=>{const{getTextAnchor:n,getAlignmentBaseline:s}=this.props,{x:r,y:o,rowWidth:a,size:[,c]}=this.transformParagraph(e,t),l=Fh[typeof n=="function"?n(e,t):n],u=zh[typeof s=="function"?s(e,t):s],f=r.length,d=new Array(f*2);let h=0;for(let g=0;g<f;g++)d[h++]=(l-1)*a[g]/2+r[g],d[h++]=(u-1)*c/2+o[g];return d}}initializeState(){this.state={styleVersion:0,fontAtlasManager:new sk},this.props.maxWidth>0&&K.once(1,"v8.9 breaking change: TextLayer maxWidth is now relative to text size")()}updateState(e){const{props:t,oldProps:n,changeFlags:s}=e;(s.dataChanged||s.updateTriggersChanged&&(s.updateTriggersChanged.all||s.updateTriggersChanged.getText))&&this._updateText(),(this._updateFontAtlas()||t.lineHeight!==n.lineHeight||t.wordBreak!==n.wordBreak||t.maxWidth!==n.maxWidth)&&this.setState({styleVersion:this.state.styleVersion+1})}getPickingInfo({info:e}){return e.object=e.index>=0?this.props.data[e.index]:null,e}_updateFontAtlas(){const{fontSettings:e,fontFamily:t,fontWeight:n,_getFontRenderer:s}=this.props,{fontAtlasManager:r,characterSet:o}=this.state,a={...e,characterSet:o,fontFamily:t,fontWeight:n,_getFontRenderer:s};if(!r.mapping)return r.setProps(a),!0;for(const c in a)if(a[c]!==r.props[c])return r.setProps(a),!0;return!1}_updateText(){const{data:e,characterSet:t}=this.props,n=e.attributes?.getText;let{getText:s}=this.props,r=e.startIndices,o;const a=t==="auto"&&new Set;if(n&&r){const{texts:c,characterCount:l}=QO({...ArrayBuffer.isView(n)?{value:n}:n,length:e.length,startIndices:r,characterSet:a});o=l,s=(u,{index:f})=>c[f]}else{const{iterable:c,objectInfo:l}=os(e);r=[0],o=0;for(const u of c){l.index++;const f=Array.from(s(u,l)||"");a&&f.forEach(a.add,a),o+=f.length,r.push(o)}}this.setState({getText:s,startIndices:r,numInstances:o,characterSet:a||t})}transformParagraph(e,t){const{fontAtlasManager:n}=this.state,s=n.mapping,{baselineOffset:r}=n.atlas,{fontSize:o}=n.props,a=this.state.getText,{wordBreak:c,lineHeight:l,maxWidth:u}=this.props,f=a(e,t)||"";return KO(f,r,l*o,c,u*o,s)}renderLayers(){const{startIndices:e,numInstances:t,getText:n,fontAtlasManager:{atlas:s,mapping:r},styleVersion:o}=this.state,{data:a,_dataDiff:c,getPosition:l,getColor:u,getSize:f,getAngle:d,getPixelOffset:h,getBackgroundColor:g,getBorderColor:p,getBorderWidth:m,getContentBox:_,backgroundBorderRadius:v,backgroundPadding:b,background:x,billboard:w,fontSettings:C,outlineWidth:B,outlineColor:F,sizeScale:D,sizeUnits:k,sizeMinPixels:W,sizeMaxPixels:G,contentCutoffPixels:z,contentAlignHorizontal:V,contentAlignVertical:J,transitions:y,updateTriggers:S}=this.props,P=this.getSubLayerClass("characters",ru),T=this.getSubLayerClass("background",au),{fontSize:L}=this.state.fontAtlasManager.props;return[x&&new T({getFillColor:g,getLineColor:p,getLineWidth:m,borderRadius:v,padding:b,getPosition:l,getSize:f,getAngle:d,getPixelOffset:h,getClipRect:_,billboard:w,sizeScale:D,sizeUnits:k,sizeMinPixels:W,sizeMaxPixels:G,fontSize:L,transitions:y&&{getPosition:y.getPosition,getAngle:y.getAngle,getSize:y.getSize,getFillColor:y.getBackgroundColor,getLineColor:y.getBorderColor,getLineWidth:y.getBorderWidth,getPixelOffset:y.getPixelOffset}},this.getSubLayerProps({id:"background",updateTriggers:{getPosition:S.getPosition,getAngle:S.getAngle,getSize:S.getSize,getFillColor:S.getBackgroundColor,getLineColor:S.getBorderColor,getLineWidth:S.getBorderWidth,getPixelOffset:S.getPixelOffset,getBoundingRect:{getText:S.getText,getTextAnchor:S.getTextAnchor,getAlignmentBaseline:S.getAlignmentBaseline,styleVersion:o}}}),{data:a.attributes&&a.attributes.background?{length:a.length,attributes:a.attributes.background}:a,_dataDiff:c,autoHighlight:!1,getBoundingRect:this.getBoundingRect}),new P({sdf:C.sdf,smoothing:Number.isFinite(C.smoothing)?C.smoothing:ji.smoothing,outlineWidth:B/(C.radius||ji.radius),outlineColor:F,iconAtlas:s,iconMapping:r,getPosition:l,getColor:u,getSize:f,getAngle:d,getPixelOffset:h,getContentBox:_,billboard:w,sizeScale:D,sizeUnits:k,sizeMinPixels:W,sizeMaxPixels:G,fontSize:L,contentCutoffPixels:z,contentAlignHorizontal:V,contentAlignVertical:J,transitions:y&&{getPosition:y.getPosition,getAngle:y.getAngle,getColor:y.getColor,getSize:y.getSize,getPixelOffset:y.getPixelOffset,getContentBox:y.getContentBox}},this.getSubLayerProps({id:"characters",updateTriggers:{all:S.getText,getPosition:S.getPosition,getAngle:S.getAngle,getColor:S.getColor,getSize:S.getSize,getPixelOffset:S.getPixelOffset,getContentBox:S.getContentBox,getIconOffsets:{getTextAnchor:S.getTextAnchor,getAlignmentBaseline:S.getAlignmentBaseline,styleVersion:o}}}),{data:a,_dataDiff:c,startIndices:e,numInstances:t,getIconOffsets:this.getIconOffsets,getIcon:n})]}static set fontAtlasCacheLimit(e){nk(e)}}cu.defaultProps=hk;cu.layerName="TextLayer";const Js={circle:{type:He,props:{filled:"filled",stroked:"stroked",lineWidthMaxPixels:"lineWidthMaxPixels",lineWidthMinPixels:"lineWidthMinPixels",lineWidthScale:"lineWidthScale",lineWidthUnits:"lineWidthUnits",pointRadiusMaxPixels:"radiusMaxPixels",pointRadiusMinPixels:"radiusMinPixels",pointRadiusScale:"radiusScale",pointRadiusUnits:"radiusUnits",pointAntialiasing:"antialiasing",pointBillboard:"billboard",getFillColor:"getFillColor",getLineColor:"getLineColor",getLineWidth:"getLineWidth",getPointRadius:"getRadius"}},icon:{type:Qi,props:{iconAtlas:"iconAtlas",iconMapping:"iconMapping",iconSizeMaxPixels:"sizeMaxPixels",iconSizeMinPixels:"sizeMinPixels",iconSizeScale:"sizeScale",iconSizeUnits:"sizeUnits",iconAlphaCutoff:"alphaCutoff",iconBillboard:"billboard",getIcon:"getIcon",getIconAngle:"getAngle",getIconColor:"getColor",getIconPixelOffset:"getPixelOffset",getIconSize:"getSize"}},text:{type:cu,props:{textSizeMaxPixels:"sizeMaxPixels",textSizeMinPixels:"sizeMinPixels",textSizeScale:"sizeScale",textSizeUnits:"sizeUnits",textBackground:"background",textBackgroundPadding:"backgroundPadding",textFontFamily:"fontFamily",textFontWeight:"fontWeight",textLineHeight:"lineHeight",textMaxWidth:"maxWidth",textOutlineColor:"outlineColor",textOutlineWidth:"outlineWidth",textWordBreak:"wordBreak",textCharacterSet:"characterSet",textBillboard:"billboard",textFontSettings:"fontSettings",getText:"getText",getTextAngle:"getAngle",getTextColor:"getColor",getTextPixelOffset:"getPixelOffset",getTextSize:"getSize",getTextAnchor:"getTextAnchor",getTextAlignmentBaseline:"getAlignmentBaseline",getTextBackgroundColor:"getBackgroundColor",getTextBorderColor:"getBorderColor",getTextBorderWidth:"getBorderWidth"}}},er={type:ao,props:{lineWidthUnits:"widthUnits",lineWidthScale:"widthScale",lineWidthMinPixels:"widthMinPixels",lineWidthMaxPixels:"widthMaxPixels",lineJointRounded:"jointRounded",lineCapRounded:"capRounded",lineMiterLimit:"miterLimit",lineBillboard:"billboard",lineAntialiasing:"antialiasing",getLineColor:"getColor",getLineWidth:"getWidth"}},Gc={type:su,props:{extruded:"extruded",filled:"filled",wireframe:"wireframe",elevationScale:"elevationScale",material:"material",_full3d:"_full3d",getElevation:"getElevation",getFillColor:"getFillColor",getLineColor:"getLineColor"}};function xn({type:i,props:e}){const t={};for(const n in e)t[n]=i.defaultProps[e[n]];return t}function Ia(i,e){const{transitions:t,updateTriggers:n}=i.props,s={updateTriggers:{},transitions:t&&{getPosition:t.geometry}};for(const r in e){const o=e[r];let a=i.props[r];r.startsWith("get")&&(a=i.getSubLayerAccessor(a),s.updateTriggers[o]=n[r],t&&(s.transitions[o]=t[r])),s[o]=a}return s}function gk(i){if(Array.isArray(i))return i;switch(K.assert(i.type,"GeoJSON does not have type"),i.type){case"Feature":return[i];case"FeatureCollection":return K.assert(Array.isArray(i.features),"GeoJSON does not have features array"),i.features;default:return[{geometry:i}]}}function Nh(i,e,t={}){const n={pointFeatures:[],lineFeatures:[],polygonFeatures:[],polygonOutlineFeatures:[]},{startRow:s=0,endRow:r=i.length}=t;for(let o=s;o<r;o++){const a=i[o],{geometry:c}=a;if(c)if(c.type==="GeometryCollection"){K.assert(Array.isArray(c.geometries),"GeoJSON does not have geometries array");const{geometries:l}=c;for(let u=0;u<l.length;u++){const f=l[u];Uh(f,n,e,a,o)}}else Uh(c,n,e,a,o)}return n}function Uh(i,e,t,n,s){const{type:r,coordinates:o}=i,{pointFeatures:a,lineFeatures:c,polygonFeatures:l,polygonOutlineFeatures:u}=e;if(!mk(r,o)){K.warn(`${r} coordinates are malformed`)();return}switch(r){case"Point":a.push(t({geometry:i},n,s));break;case"MultiPoint":o.forEach(f=>{a.push(t({geometry:{type:"Point",coordinates:f}},n,s))});break;case"LineString":c.push(t({geometry:i},n,s));break;case"MultiLineString":o.forEach(f=>{c.push(t({geometry:{type:"LineString",coordinates:f}},n,s))});break;case"Polygon":l.push(t({geometry:i},n,s)),o.forEach(f=>{u.push(t({geometry:{type:"LineString",coordinates:f}},n,s))});break;case"MultiPolygon":o.forEach(f=>{l.push(t({geometry:{type:"Polygon",coordinates:f}},n,s)),f.forEach(d=>{u.push(t({geometry:{type:"LineString",coordinates:d}},n,s))})});break}}const pk={Point:1,MultiPoint:2,LineString:2,MultiLineString:3,Polygon:3,MultiPolygon:4};function mk(i,e){let t=pk[i];for(K.assert(t,`Unknown GeoJSON type ${i}`);e&&--t>0;)e=e[0];return e&&Number.isFinite(e[0])}function py(){return{points:{},lines:{},polygons:{},polygonsOutline:{}}}function Fs(i){return i.geometry.coordinates}function yk(i,e){const t=py(),{pointFeatures:n,lineFeatures:s,polygonFeatures:r,polygonOutlineFeatures:o}=i;return t.points.data=n,t.points._dataDiff=e.pointFeatures&&(()=>e.pointFeatures),t.points.getPosition=Fs,t.lines.data=s,t.lines._dataDiff=e.lineFeatures&&(()=>e.lineFeatures),t.lines.getPath=Fs,t.polygons.data=r,t.polygons._dataDiff=e.polygonFeatures&&(()=>e.polygonFeatures),t.polygons.getPolygon=Fs,t.polygonsOutline.data=o,t.polygonsOutline._dataDiff=e.polygonOutlineFeatures&&(()=>e.polygonOutlineFeatures),t.polygonsOutline.getPath=Fs,t}function _k(i){const e=py(),{points:t,lines:n,polygons:s}=i,r=BO(i);e.points.data={length:t.positions.value.length/t.positions.size,attributes:{...t.attributes,getPosition:t.positions,rowIndexes:{size:1,type:"uint32",value:r.points}},properties:t.properties,numericProps:t.numericProps,featureIds:t.featureIds},e.lines.data={length:n.pathIndices.value.length-1,startIndices:n.pathIndices.value,attributes:{...n.attributes,getPath:n.positions,rowIndexes:{size:1,type:"uint32",value:r.lines}},properties:n.properties,numericProps:n.numericProps,featureIds:n.featureIds},e.lines._pathType="open";const o=s.positions.value.length/s.positions.size,a=Array(o).fill(1);for(const c of s.primitivePolygonIndices.value)a[c-1]=0;return e.polygons.data={length:s.polygonIndices.value.length-1,startIndices:s.polygonIndices.value,attributes:{...s.attributes,getPolygon:s.positions,instanceVertexValid:{size:1,value:new Uint16Array(a)},rowIndexes:{size:1,type:"uint32",value:r.polygons}},properties:s.properties,numericProps:s.numericProps,featureIds:s.featureIds},e.polygons._normalize=!1,s.triangles&&(e.polygons.data.attributes.indices=s.triangles.value),e.polygonsOutline.data={length:s.primitivePolygonIndices.value.length-1,startIndices:s.primitivePolygonIndices.value,attributes:{...s.attributes,getPath:s.positions,rowIndexes:{size:1,type:"uint32",value:r.polygons}},properties:s.properties,numericProps:s.numericProps,featureIds:s.featureIds},e.polygonsOutline._pathType="open",e}const bk=["points","linestrings","polygons"],vk={...xn(Js.circle),...xn(Js.icon),...xn(Js.text),...xn(er),...xn(Gc),stroked:!0,filled:!0,extruded:!1,wireframe:!1,_full3d:!1,iconAtlas:{type:"object",value:null},iconMapping:{type:"object",value:{}},getIcon:{type:"accessor",value:i=>i.properties.icon},getText:{type:"accessor",value:i=>i.properties.text},pointType:"circle",getRadius:{deprecatedFor:"getPointRadius"}};class ti extends Ql{initializeState(){this.state={layerProps:{},features:{},featuresDiff:{}}}updateState({props:e,changeFlags:t}){if(!t.dataChanged)return;const{data:n}=this.props,s=n&&"points"in n&&"polygons"in n&&"lines"in n;this.setState({binary:s}),s?this._updateStateBinary({props:e,changeFlags:t}):this._updateStateJSON({props:e,changeFlags:t})}_updateStateBinary({props:e,changeFlags:t}){const n=_k(e.data);this.setState({layerProps:n})}_updateStateJSON({props:e,changeFlags:t}){const n=gk(e.data),s=this.getSubLayerRow.bind(this);let r={};const o={};if(Array.isArray(t.dataChanged)){const c=this.state.features;for(const l in c)r[l]=c[l].slice(),o[l]=[];for(const l of t.dataChanged){const u=Nh(n,s,l);for(const f in c)o[f].push(RO({data:r[f],getIndex:d=>d.__source.index,dataRange:l,replace:u[f]}))}}else r=Nh(n,s);const a=yk(r,o);this.setState({features:r,featuresDiff:o,layerProps:a})}getPickingInfo(e){const t=super.getPickingInfo(e),{index:n,sourceLayer:s}=t;return t.featureType=bk.find(r=>s.id.startsWith(`${this.id}-${r}-`)),n>=0&&s.id.startsWith(`${this.id}-points-text`)&&this.state.binary&&(t.index=this.props.data.points.globalFeatureIds.value[n]),t}_updateAutoHighlight(e){const t=`${this.id}-points-`,n=e.featureType==="points";for(const s of this.getSubLayers())s.id.startsWith(t)===n&&s.updateAutoHighlight(e)}_renderPolygonLayer(){const{extruded:e,wireframe:t}=this.props,{layerProps:n}=this.state,s="polygons-fill",r=this.shouldRenderSubLayer(s,n.polygons?.data)&&this.getSubLayerClass(s,Gc.type);if(r){const o=Ia(this,Gc.props),a=e&&t;return a||delete o.getLineColor,o.updateTriggers.lineColors=a,new r(o,this.getSubLayerProps({id:s,updateTriggers:o.updateTriggers}),n.polygons)}return null}_renderLineLayers(){const{extruded:e,stroked:t}=this.props,{layerProps:n}=this.state,s="polygons-stroke",r="linestrings",o=!e&&t&&this.shouldRenderSubLayer(s,n.polygonsOutline?.data)&&this.getSubLayerClass(s,er.type),a=this.shouldRenderSubLayer(r,n.lines?.data)&&this.getSubLayerClass(r,er.type);if(o||a){const c=Ia(this,er.props);return[o&&new o(c,this.getSubLayerProps({id:s,updateTriggers:c.updateTriggers}),n.polygonsOutline),a&&new a(c,this.getSubLayerProps({id:r,updateTriggers:c.updateTriggers}),n.lines)]}return null}_renderPointLayers(){const{pointType:e}=this.props,{layerProps:t,binary:n}=this.state;let{highlightedObjectIndex:s}=this.props;!n&&Number.isFinite(s)&&(s=t.points.data.findIndex(a=>a.__source.index===s));const r=new Set(e.split("+")),o=[];for(const a of r){const c=`points-${a}`,l=Js[a],u=l&&this.shouldRenderSubLayer(c,t.points?.data)&&this.getSubLayerClass(c,l.type);if(u){const f=Ia(this,l.props);let d=t.points;if(a==="text"&&n){const{rowIndexes:h,...g}=d.data.attributes;d={...d,data:{...d.data,attributes:g}}}o.push(new u(f,this.getSubLayerProps({id:c,updateTriggers:f.updateTriggers,highlightedObjectIndex:s}),d))}}return o}renderLayers(){const{extruded:e}=this.props,t=this._renderPolygonLayer(),n=this._renderLineLayers(),s=this._renderPointLayers();return[!e&&t,n,s,e&&t]}getSubLayerAccessor(e){const{binary:t}=this.state;return!t||typeof e!="function"?super.getSubLayerAccessor(e):(n,s)=>{const{data:r,index:o}=s,a=OO(r,o);return e(a,s)}}}ti.layerName="GeoJsonLayer";ti.defaultProps=vk;const zi=4,my=16,X=my*zi,yy=28/32,Nr=48,Rt=8,xk=7,wk=2,Pk={escalating:[[0,4.5],[4.5,-3.5],[-4.5,-3.5]],cooling:[[-4.5,3.5],[4.5,3.5],[0,-4.5]],steady:[[0,4.5],[4.5,0],[0,-4.5],[-4.5,0]],new:Array.from({length:10},(i,e)=>[3.8*Math.cos(e/10*2*Math.PI),3.8*Math.sin(e/10*2*Math.PI)])},Sk=1.45,Ek=6,Ck=9,Un={escalating:{x:0,y:0,width:X,height:X,anchorX:X/2,anchorY:X/2,mask:!0},cooling:{x:X,y:0,width:X,height:X,anchorX:X/2,anchorY:X/2,mask:!0},steady:{x:X*2,y:0,width:X,height:X,anchorX:X/2,anchorY:X/2,mask:!0},new:{x:X*3,y:0,width:X,height:X,anchorX:X/2,anchorY:X/2,mask:!0},diamond:{x:X*4,y:0,width:X,height:X,anchorX:X/2,anchorY:X/2,mask:!0},corner:{x:X*5,y:0,width:Nr,height:Nr,anchorX:Rt,anchorY:Rt,mask:!0}},Lk=X*5+Nr,Tk=X,$h=my,Gh=Nr/zi,Vh=i=>i*2/yy;function jh(i){const e=i+Ek;return[e,-e]}function Wh(i){return[{offset:[-i,-i],angle:0},{offset:[i,-i],angle:-90},{offset:[i,i],angle:-180},{offset:[-i,i],angle:-270}]}let zs=null;function Hh(){if(zs)return zs;if(typeof document>"u")return null;const i=document.createElement("canvas");i.width=Lk,i.height=Tk;let e=null;try{e=i.getContext("2d")}catch{e=null}if(!e)return null;e.fillStyle="#fff",e.strokeStyle="#fff";const t=(c,l,u)=>{e.beginPath(),c.forEach(([f,d],h)=>{const g=l+f*zi,p=u-d*zi;h?e.lineTo(g,p):e.moveTo(g,p)}),e.closePath(),e.fill()};["escalating","cooling","steady","new"].forEach(c=>{const l=Un[c];t(Pk[c],l.x+X/2,X/2)});const n=Un.diamond,s=X/2*yy;e.beginPath(),e.moveTo(n.x+X/2,X/2-s),e.lineTo(n.x+X/2+s,X/2),e.lineTo(n.x+X/2,X/2+s),e.lineTo(n.x+X/2-s,X/2),e.closePath(),e.fill();const r=Un.corner,o=xk*zi,a=wk*zi;return e.lineWidth=a,e.lineCap="butt",e.lineJoin="miter",e.beginPath(),e.moveTo(r.x+Rt+o,Rt),e.lineTo(r.x+Rt,Rt),e.lineTo(r.x+Rt,Rt+o),e.stroke(),zs=i,zs}const Ak=`
{
  vec3 gp = geometry.position.xyz;
  vec3 cam = project.cameraPosition;
  bool hide = dot(gp, cam - gp) <= 0.0;
  if (!hide) {
    float D = length(cam);
    float R = 256.0;
    vec3 ax = cam / D;
    vec3 ref = abs(ax.z) < 0.9 ? vec3(0.0, 0.0, 1.0) : vec3(1.0, 0.0, 0.0);
    vec3 ux = normalize(cross(ax, ref));
    float kk = R / D;
    vec3 limb = R * (kk * ax + sqrt(max(1.0 - kk * kk, 0.0)) * ux);
    vec4 cl = project_common_position_to_clipspace(vec4(limb, 1.0));
    vec4 c0 = project_common_position_to_clipspace(vec4(0.0, 0.0, 0.0, 1.0));
    vec2 vs = project.viewportSize;
    vec2 n0 = c0.xy / c0.w;
    float rl = length((cl.xy / cl.w - n0) * vs);
    vec2 off = project_pixel_size_to_clipspace(vec2(instancePixelOffset.x, -instancePixelOffset.y));
    vec4 ac = project_common_position_to_clipspace(vec4(gp, 1.0));
    vec2 sc = (ac.xy + off) / ac.w;
    hide = length((sc - n0) * vs) > rl - 1.0;
  }
  if (hide) { gl_Position = vec4(0.0, 0.0, 2.0, 1.0); }
}`;class _y extends eu{getShaders(){return{inject:{"vs:#main-end":Ak}}}}_y.extensionName="GlobeHorizon";const Yh=[new _y],qh=ky("/"),Mk=[-180,-90,180,90],Ik=3,tr={conflict:[238,119,84],political:[155,140,248],economic:[56,182,222],humanitarian:[216,158,40]},Ai=[154,164,178],Ra=3e4,Mt={depthWriteEnabled:!1},Zh={cullMode:"none"},Oa=[238,245,249],ka=[4,7,12],Ns=i=>i.size.ringR||i.size.r,by=Ly(hu,hu.objects.countries).features,vy={},xy={};for(const i of by)vy[i.id]=i,xy[i.id]=Hy(i);function wn(i){const e=nr[i],t=e?xy[e]:Ry[i];return t&&Number.isFinite(t[0])?t:null}function Ba(i){const e=nr[i];return e?vy[e]:null}const Rk={longitude:12,latitude:18,pitch:0,bearing:0,minZoom:-.5,maxZoom:6},Xh=(i,e)=>({...Rk,zoom:Qh(i,Jh(e,i))}),Ok=58;function kk(i,e,t,n){const s=Math.PI/180,r=[Math.cos(e*s)*Math.cos(i*s),Math.cos(e*s)*Math.sin(i*s),Math.sin(e*s)],o=[Math.cos(n*s)*Math.cos(t*s),Math.cos(n*s)*Math.sin(t*s),Math.sin(n*s)];return r[0]*o[0]+r[1]*o[1]+r[2]*o[2]>.05}const Kt=288,Mi=128,It=14;function Bk(i,e,t,n,s=8){const o=[{left:i+It,top:e-Mi-It},{left:i-Kt-It,top:e-Mi-It},{left:i+It,top:e+It},{left:i-Kt-It,top:e+It}];for(const d of o)if(d.left>=8&&d.top>=s&&d.left+Kt<=t-8&&d.top+Mi<=n-8)return{left:d.left,top:d.top,leader:null};const a=Math.min(Math.max(i-Kt/2,8),t-Kt-8),c=Math.min(Math.max(e-Mi/2,s),n-Mi-8),l=Math.min(Math.max(i,a),a+Kt),u=Math.min(Math.max(e,c),c+Mi),f=Math.hypot(i-l,e-u);return{left:a,top:c,leader:f>6&&f<180?{x1:l,y1:u,x2:i,y2:e}:null}}const Kh={high:"High",elevated:"Elevated",moderate:"Moderate",low:"Low"};function Dk({situations:i=[],focusId:e,callout:t=null,tour:n=null,newIds:s=null,view:r="globe",onSelect:o,onOpenCallout:a,height:c=560,width:l=null,shading:u=[],linkArcs:f=[],storyFocusIso3:d=null,onSelectCountry:h,onHoverCountry:g,onFocusCountry:p,onLeaveCountry:m,countryRisk:_=[],onSelectCountryRisk:v,onHoverCountryRisk:b,onFocusCountryRisk:x,onLeaveCountryRisk:w,onFirstDraw:C,onDrawError:B}){const F=N.useRef(C);F.current=C;const D=N.useRef(!1),k=N.useRef(B);k.current=B;const W=N.useRef(c);W.current=c;const G=N.useRef(l);G.current=l;const[z,V]=N.useState(()=>Xh(c,l)),J=N.useRef(z),y=N.useCallback(E=>{const M=typeof E=="function"?E(J.current):E;M!==J.current&&(J.current=M,V(M))},[]),S=()=>P.current?.deck||null,P=N.useRef(null),T=N.useRef(!1),L=N.useMemo(()=>{try{return window.matchMedia("(prefers-reduced-motion: reduce)").matches}catch{return!1}},[]),[I,R]=N.useState(!L),U=N.useCallback(()=>R(!1),[]),Y=N.useCallback(()=>{T.current=!1,R(!0)},[]),j=N.useRef(null),[ee,ae]=N.useState({width:1,height:c}),[ie,be]=N.useState(!0);N.useEffect(()=>{if(!j.current||typeof IntersectionObserver!="function")return;const E=new IntersectionObserver(M=>be(M[0]?.isIntersecting??!0),{threshold:.01});return E.observe(j.current),()=>E.disconnect()},[]);const oe=N.useRef(ie);oe.current=ie;const tt=N.useCallback(()=>typeof document<"u"&&document.hidden||!oe.current,[]),[vt,cs]=N.useState(!1);N.useEffect(()=>{let E=!1;const M=()=>{const ce=new Image;ce.onload=()=>{E||cs(!0)},ce.onerror=()=>{},ce.src=qh},H=typeof requestIdleCallback=="function"?requestIdleCallback:ce=>setTimeout(ce,200),ue=typeof cancelIdleCallback=="function"?cancelIdleCallback:clearTimeout,pe=H(M,{timeout:2e3});return()=>{E=!0,ue(pe)}},[]);const xt=N.useMemo(()=>i.filter(E=>E.state!=="closed"&&E.centroid&&gu(E)!=="hidden"),[i]),te=E=>tr[E.axis]||Ai,ne=E=>[E.centroid.lon,E.centroid.lat,Ra],Wt=N.useMemo(()=>xt.map(E=>{const M=gu(E),H=My(M),ue=tr[E.axis]||Ai;return{s:E,fresh:M,look:H,kind:Ay(E),size:un(E.tier),glyph:pu(E),rgb:H.desaturate?Ty(ue):ue,position:[E.centroid.lon,E.centroid.lat,Ra]}}),[xt]),co=N.useMemo(()=>{const E=e&&i.find(Ie=>Ie.id===e&&Ie.centroid);if(!E)return null;const M=tr[E.axis]||Ai,H=[E.centroid.lon,E.centroid.lat],ue=(E.iso3_affected||[]).map(Ie=>nr[Ie]).find(Boolean),pe=[],ce=[],ze=[];for(const Ie of E.iso3_affected||[]){const Ht=Ba(Ie);Ht&&nr[Ie]!==ue&&pe.push(Ht);const O=wn(Ie);O&&Math.hypot(O[0]-H[0],O[1]-H[1])>1.5&&(ce.push({from:H,to:O}),ze.push(O))}return{rgb:M,fills:pe,arcs:ce,dests:ze}},[e,i]),ls=N.useCallback((E,M)=>{const H=j.current?.getBoundingClientRect();return H?{getBoundingClientRect:()=>({top:H.top+M-2,bottom:H.top+M+2,left:H.left+E-2,right:H.left+E+2})}:null},[]),lo=N.useMemo(()=>(u||[]).map(E=>{const M=Ba(E.iso3);return M?{...M,properties:{...M.properties,__iso3:E.iso3,__count:E.count,__dim:E.dim,__rgb:yu[E.crisisType]||yu.neutral}}:null}).filter(Boolean),[u]),uo=N.useMemo(()=>lo.length?new ti({id:"story-shade",data:lo,stroked:!0,filled:!0,pickable:!0,getFillColor:E=>[...E.properties.__rgb,E.properties.__dim?26:46],getLineColor:E=>E.properties.__iso3===d?[255,255,255,230]:[...E.properties.__rgb,130],getLineWidth:E=>E.properties.__iso3===d?2.5:1,lineWidthUnits:"pixels",lineWidthMinPixels:1,onClick:E=>E.object&&h&&h(E.object.properties.__iso3),onHover:E=>{if(E.object){const M=ls(E.x,E.y);M&&g&&g(E.object.properties.__iso3,M)}else m&&m()},updateTriggers:{getLineColor:[d],getLineWidth:[d]}}):null,[lo,d,h,g,m,ls]),ln=N.useMemo(()=>(_||[]).map(E=>{const M=Ba(E.iso3);return M?{...M,properties:{...M.properties,__risk:E}}:null}).filter(Boolean),[_]),fo=N.useMemo(()=>ln.length?new ti({id:"country-risk",data:ln,stroked:!0,filled:!0,pickable:!0,getFillColor:E=>[...wo(E.properties.__risk.hue)||Ai,E.properties.__risk.older?20:40],getLineColor:E=>[...wo(E.properties.__risk.hue)||Ai,E.properties.__risk.older?110:210],getLineWidth:E=>E.properties.__risk.outlineWidth,lineWidthUnits:"pixels",lineWidthMinPixels:1,onClick:E=>E.object&&v&&v(E.object.properties.__risk),onHover:E=>{if(E.object){const M=ls(E.x,E.y);M&&b&&b(E.object.properties.__risk,M)}else w&&w()}}):null,[ln,v,b,w,ls]),ho=N.useMemo(()=>{const E=ln.filter(M=>M.properties.__risk.doubleOutline);return E.length?new ti({id:"country-risk-double",data:E,stroked:!0,filled:!1,pickable:!1,getLineColor:M=>[...wo(M.properties.__risk.hue)||Ai,M.properties.__risk.older?60:120],getLineWidth:M=>M.properties.__risk.outlineWidth+2.5,lineWidthUnits:"pixels",lineWidthMinPixels:1}):null},[ln]);N.useEffect(()=>{if(!j.current)return;const E=new ResizeObserver(M=>{const H=M[0]?.contentRect;H&&ae({width:H.width,height:H.height})});return E.observe(j.current),()=>E.disconnect()},[]);const us=N.useMemo(()=>{const E=i.find(M=>M.id===e&&M.centroid);if(E)return`${E.centroid.lon},${E.centroid.lat}`;if(d){const M=wn(d);if(M)return`${M[0]},${M[1]}`}return null},[i,e,d]);N.useEffect(()=>{if(us){U();const[E,M]=us.split(",").map(Number);y(H=>({...H,longitude:E,latitude:M-4,zoom:2.1,...L?{}:{transitionDuration:1300,transitionInterpolator:new oh({speed:1.4})}}))}else T.current&&y(E=>({...E,...Xh(W.current,G.current),...L?{}:{transitionDuration:1100,transitionInterpolator:new oh}}))},[us,L,U,y]),N.useEffect(()=>{if(T.current||us)return;const E=Qh(c,Jh(l,c));y(M=>Math.abs((M.zoom??0)-E)<.01?M:{...M,zoom:E})},[c,l]),N.useEffect(()=>{if(!I||L)return;let E,M=null,H=0;const ue=1e3/30,pe=ce=>{if(M!=null&&!T.current&&!tt()){const ze=ce-M,{transitionDuration:Ie,transitionInterpolator:Ht,...O}=J.current;J.current={...O,longitude:Dy(O.longitude,ze,Ik)},ce-H>=ue&&(H=ce,V(J.current))}M=ce,E=requestAnimationFrame(pe)};return E=requestAnimationFrame(pe),()=>cancelAnimationFrame(E)},[I,L,tt]);const go=vt,po=N.useMemo(()=>vt?new iu({id:"earth-night",image:qh,bounds:Mk,opacity:.8,pickable:!1}):null,[vt]),lu=N.useMemo(()=>new ti({id:"land",data:by,stroked:!0,filled:!0,extruded:!1,getFillColor:go?[24,31,44,30]:[24,31,44,255],getLineColor:go?[90,105,130,130]:[40,50,68,255],lineWidthMinPixels:.5}),[go]),We=N.useMemo(()=>{const E=Hh(),M=(O,xi)=>e&&O.s.id!==e?Math.round(xi*.4):xi,H=Wt.filter(O=>O.kind==="situation"),ue=Wt.filter(O=>O.kind==="alert"),pe={getFillColor:[e],getColor:[e]},ce=O=>O.object&&o&&o(O.object.s.id),ze=(O,xi,du)=>E?new Qi({id:O,data:xi,iconAtlas:E,iconMapping:Un,billboard:!0,sizeUnits:"pixels",extensions:Yh,getPosition:Ey=>Ey.position,updateTriggers:{getColor:[e]},...du,parameters:{...Zh,...du.parameters}}):null,Ie=Wt.filter(O=>O.glyph),Ht=Wt.filter(O=>O.s.id===e);return{glow:new He({id:"fresh-glow",parameters:Mt,data:Wt.filter(O=>O.look.glow),getPosition:O=>O.position,radiusUnits:"pixels",stroked:!1,pickable:!1,getRadius:O=>Ns(O)+9,getFillColor:O=>[...O.rgb,M(O,70)],updateTriggers:pe}),softOuter:new He({id:"soft-outer",parameters:Mt,data:H,getPosition:O=>O.position,radiusUnits:"pixels",stroked:!1,pickable:!1,getRadius:O=>O.size.r+12,getFillColor:O=>[...O.rgb,M(O,O.look.desaturate?16:28)],updateTriggers:pe}),softInner:new He({id:"soft-inner",parameters:Mt,data:H,getPosition:O=>O.position,radiusUnits:"pixels",stroked:!1,pickable:!1,getRadius:O=>O.size.r+5,getFillColor:O=>[...O.rgb,M(O,O.look.desaturate?34:64)],updateTriggers:pe}),highRing:new He({id:"high-ring",parameters:Mt,data:Wt.filter(O=>O.size.doubleRing),getPosition:O=>O.position,radiusUnits:"pixels",filled:!1,stroked:!0,pickable:!1,lineWidthUnits:"pixels",getRadius:O=>O.size.ringR,getLineWidth:1.5,getLineColor:O=>[...O.rgb,M(O,230)],updateTriggers:{getLineColor:[e]}}),dots:new He({id:"core",data:H,pickable:!0,radiusUnits:"pixels",getPosition:O=>O.position,getRadius:O=>Math.max(3,O.size.r*.6),getFillColor:O=>[...O.rgb,M(O,O.look.desaturate?215:255)],stroked:!0,lineWidthUnits:"pixels",getLineWidth:1,getLineColor:[...ka,255],onClick:ce,updateTriggers:pe}),alertEdge:ze("alert-edge",ue,{parameters:Mt,getIcon:()=>"diamond",getSize:O=>Vh(O.size.r*1.2+1.5),getColor:O=>[...ka,M(O,255)]}),alertCore:ze("alert-core",ue,{getIcon:()=>"diamond",getSize:O=>Vh(O.size.r*1.2),getColor:O=>[...O.rgb,M(O,O.look.desaturate?215:255)],pickable:!0,onClick:ce}),badgeEdge:ze("badge-edge",Ie,{parameters:Mt,getIcon:O=>O.glyph.key,getSize:$h*Sk,getPixelOffset:O=>jh(Ns(O)),getColor:O=>[...ka,M(O,230)]}),badges:ze("badges",Ie,{getIcon:O=>O.glyph.key,getSize:$h,getPixelOffset:O=>jh(Ns(O)),getColor:O=>[...Oa,M(O,255)]}),brackets:ze("brackets",Ht.flatMap(O=>Wh(Ns(O)+Ck).map(xi=>({...xi,position:O.position}))),{getIcon:()=>"corner",getSize:Gh,getPixelOffset:O=>O.offset,getAngle:O=>O.angle,getColor:[...Oa,255],updateTriggers:{}})}},[Wt,e]),mo=N.useMemo(()=>{const E=d?wn(d):null,M=E?Hh():null;return M?new Qi({id:"story-brackets",iconAtlas:M,iconMapping:Un,billboard:!0,sizeUnits:"pixels",parameters:Zh,extensions:Yh,data:Wh(16).map(H=>({...H,position:[E[0],E[1],Ra]})),getPosition:H=>H.position,getIcon:()=>"corner",getSize:Gh,getPixelOffset:H=>H.offset,getAngle:H=>H.angle,getColor:[...Oa,255],pickable:!1}):null},[d]),uu=N.useMemo(()=>Iy(xt,Date.now(),8),[xt]),Ct=N.useMemo(()=>xt.filter(E=>uu.has(E.id)),[xt,uu]),yo=N.useCallback(E=>!L&&Ct.length?new He({id:"pulse",parameters:Mt,data:Ct,getPosition:ne,radiusUnits:"pixels",pickable:!1,getRadius:M=>(un(M.tier).ringR||un(M.tier).r)+6+E*18,getFillColor:M=>[...te(M),Math.round(150*(1-E))]}):null,[L,Ct]),_o=N.useMemo(()=>L&&Ct.length?new He({id:"pulse-still",parameters:Mt,data:Ct,getPosition:ne,radiusUnits:"pixels",pickable:!1,getRadius:E=>(un(E.tier).ringR||un(E.tier).r)+7,filled:!1,stroked:!0,getLineColor:E=>[...te(E),190],getLineWidth:1.5,lineWidthUnits:"pixels"}):null,[L,Ct]),fu=N.useRef(0),wy=yo(fu.current),bo=N.useMemo(()=>{if(!co)return[];const{rgb:E,fills:M,arcs:H,dests:ue}=co,pe=[];return M.length&&pe.push(new ti({id:"affected-fill",data:{type:"FeatureCollection",features:M},stroked:!0,filled:!0,getFillColor:[...E,24],getLineColor:[...E,90],lineWidthMinPixels:1,pickable:!1})),H.length&&pe.push(new tu({id:"spread-arcs",data:H,getSourcePosition:ce=>ce.from,getTargetPosition:ce=>ce.to,getSourceColor:[...E,210],getTargetColor:[...E,40],getWidth:1.5,pickable:!1})),ue.length&&pe.push(new He({id:"dest-rings",data:ue,getPosition:ce=>ce,radiusUnits:"pixels",getRadius:5,filled:!1,stroked:!0,getLineColor:[...E,200],getLineWidth:1.2,lineWidthUnits:"pixels",pickable:!1})),pe},[co]),vo=N.useMemo(()=>{const E=[];for(const M of f||[]){const H=wn(M.fromIso3),ue=wn(M.toIso3);H&&ue&&E.push(...Oy(H,ue,M.confidence))}return E.length?new ao({id:"story-link-arcs",data:E,getPath:M=>M.path,getColor:[95,212,255,200],getWidth:M=>(mu[M.confidence]||mu.medium).width,widthUnits:"pixels",capRounded:!0,pickable:!1}):null},[f]),xo=N.useCallback(E=>[...po?[po]:[],lu,...uo?[uo]:[],...fo?[fo]:[],...ho?[ho]:[],...bo.filter(M=>M.id!=="dest-rings"),...vo?[vo]:[],We.glow,We.softOuter,We.softInner,We.highRing,...E?[E]:[],..._o?[_o]:[],We.dots,We.alertEdge,We.alertCore,We.badgeEdge,We.badges,We.brackets,...mo?[mo]:[],...bo.filter(M=>M.id==="dest-rings")],[po,lu,uo,fo,ho,bo,vo,We,mo,_o]),Py=xo(wy);N.useEffect(()=>{if(L||Ct.length===0)return;let E,M=null;const H=2400,ue=pe=>{if(M==null&&(M=pe),!tt()){const ce=(pe-M)%H/H;fu.current=ce,S()?.setProps({layers:xo(yo(ce))})}E=requestAnimationFrame(ue)};return E=requestAnimationFrame(ue),()=>cancelAnimationFrame(E)},[L,Ct.length,xo,yo,tt]);const Sy=N.useCallback(({object:E})=>{const M=E?.s;if(!M||!M.verb_label)return null;const H=Kh[M.tier]||M.tier,ue=Po(M),pe=pu(M),ce=Ie=>String(Ie??"").replace(/[&<>"']/g,Ht=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[Ht]),ze=[H,ue,pe?`${pe.glyph} ${pe.label}`:null].filter(Boolean).map(ce).join(" · ");return{html:`<b>${ce(M.verb_label)}</b><br/>${ze}`,style:{background:"#0d1017",color:"#dfe6f2",fontSize:"12px",borderRadius:"7px",padding:"6px 9px",border:"1px solid #232c3a"}}},[]),Lt=N.useMemo(()=>{if(!t?.centroid||!ee.width)return null;try{const E=J.current;if(!kk(t.centroid.lon,t.centroid.lat,E.longitude,E.latitude))return null;const M=new Jl({...E,width:ee.width,height:ee.height}),[H,ue]=M.project([t.centroid.lon,t.centroid.lat]);return H<-40||ue<-40||H>ee.width+40||ue>ee.height+40?null:{px:H,py:ue,...Bk(H,ue,ee.width,ee.height,Ok)}}catch{return null}},[t,z,ee]);return de.jsxs("div",{className:"sm-wrap",style:{height:c},ref:j,children:[de.jsx(iR,{ref:P,views:new Hm,viewState:J.current,onViewStateChange:E=>{(E.interactionState?.isDragging||E.interactionState?.isZooming)&&(T.current=!0,U()),y(E.viewState)},controller:{type:Wm},layers:Py,onAfterRender:()=>{D.current||(D.current=!0,F.current?.())},onError:E=>k.current?.(E),getTooltip:Sy,pickingRadius:16,getCursor:({isDragging:E,isHovering:M})=>E?"grabbing":M?"pointer":"grab",style:{position:"relative",width:"100%",height:"100%"}}),Lt?.leader?de.jsx("svg",{className:"sm-leader",width:ee.width,height:ee.height,"aria-hidden":"true",children:de.jsx("line",{x1:Lt.leader.x1,y1:Lt.leader.y1,x2:Lt.leader.x2,y2:Lt.leader.y2})}):null,t&&Lt?de.jsxs("div",{className:"sm-callout",style:{left:Lt.left,top:Lt.top,width:Kt},children:[n?de.jsxs("div",{className:"sm-tourbar",children:[de.jsxs("span",{children:["Tour ",de.jsx("b",{children:n.index+1})," of ",n.total]}),de.jsxs("span",{className:"sm-tourbtns",children:[de.jsx("button",{onClick:n.onPrev,"aria-label":"Previous",children:"←"}),de.jsx("button",{onClick:n.onNext,"aria-label":"Next",children:"→"}),de.jsx("button",{onClick:n.onStop,children:"Stop"})]})]}):null,de.jsxs("button",{className:"sm-callout-body",onClick:()=>a&&a(t.id),children:[de.jsxs("span",{className:"sm-callout-top",children:[de.jsx("span",{className:`sh-badge sh-badge-${t.tier}`,children:Kh[t.tier]||t.tier}),de.jsx("span",{className:"sm-callout-axis",style:{color:`rgb(${te(t).join(",")})`},children:t.axis}),t.escalating?de.jsx("span",{className:"sm-callout-esc",children:"▲ escalating"}):null]}),Po(t)?de.jsx("span",{className:"sh-gdacs-badge",children:Po(t)}):null,de.jsx("span",{className:"sm-callout-title",children:t.verb_label}),t.what_changed?de.jsx("span",{className:"sm-callout-what",children:t.what_changed}):null,de.jsx("span",{className:"sm-callout-open",children:"Open →"})]}),n?de.jsx("div",{className:"sm-tourticks",children:Array.from({length:n.total}).map((E,M)=>de.jsx("i",{className:M===n.index?"on":""},M))}):null]}):null,de.jsxs("div",{className:"sm-globe-foot",children:[de.jsx("span",{className:"sm-attrib",children:"Earth at night: NASA Black Marble"}),(()=>{const E=By(L,I);return de.jsx("button",{className:"sm-spin-ctl","aria-pressed":E.pressed,"aria-label":E.label,title:E.label,disabled:E.disabled,onClick:()=>I?R(!1):Y(),children:E.disabled||E.pressed?"⏸":"▶"})})()]})]})}const Yk=Object.freeze(Object.defineProperty({__proto__:null,AXIS_RGB:tr,default:Dk},Symbol.toStringTag,{value:"Module"}));export{_A as A,Ki as B,Nl as C,ge as G,ke as M,Yk as S,re as T,xP as a,yn as b,eM as c,Hk as d,Oc as e,q2 as f,jt as g,XA as h,KA as i,QA as j,hM as k,sM as r};
