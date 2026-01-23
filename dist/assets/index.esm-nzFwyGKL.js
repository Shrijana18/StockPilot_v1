import{g as ne,a as oe,b as F,E as ie,D as se,G as m,H as ae,L as ce,I as K,J as le,K as ue,_ as D,C as N,r as de}from"./firebase-DGwrLPSD.js";/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */const fe={};/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */function k(e){return Object.isFrozen(e)&&Object.isFrozen(e.raw)}function T(e){return e.toString().indexOf("`")===-1}T(e=>e``)||T(e=>e`\0`)||T(e=>e`\n`)||T(e=>e`\u0000`);k``&&k`\0`&&k`\n`&&k`\u0000`;/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */let he="google#safe";function ge(){if(typeof window<"u")return window.trustedTypes}function U(){var e;return(e=ge())!==null&&e!==void 0?e:null}let w;function pe(){var e,t;if(w===void 0)try{w=(t=(e=U())===null||e===void 0?void 0:e.createPolicy(he,{createHTML:r=>r,createScript:r=>r,createScriptURL:r=>r}))!==null&&t!==void 0?t:null}catch{w=null}return w}/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */class z{constructor(t,r){this.privateDoNotAccessOrElseWrappedResourceUrl=t}toString(){return this.privateDoNotAccessOrElseWrappedResourceUrl.toString()}}function x(e){var t;const r=e,n=(t=pe())===null||t===void 0?void 0:t.createScriptURL(r);return n??new z(r,fe)}function ke(e){var t;if(!((t=U())===null||t===void 0)&&t.isScriptURL(e))return e;if(e instanceof z)return e.privateDoNotAccessOrElseWrappedResourceUrl;{let r="";throw new Error(r)}}/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */function Te(e,...t){if(t.length===0)return x(e[0]);e[0].toLowerCase();let r=e[0];for(let n=0;n<t.length;n++)r+=encodeURIComponent(t[n])+e[n+1];return x(r)}/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */function we(e){return ve("script",e)}function ve(e,t){var r;const n=t.document,o=(r=n.querySelector)===null||r===void 0?void 0:r.call(n,`${e}[nonce]`);return o&&(o.nonce||o.getAttribute("nonce"))||""}/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */function Ee(e){const t=e.ownerDocument&&e.ownerDocument.defaultView,r=we(t||window);r&&e.setAttribute("nonce",r)}function me(e,t,r){e.src=ke(t),Ee(e)}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const _=new Map,W={activated:!1,tokenObservers:[]},be={initialized:!1,enabled:!1};function l(e){return _.get(e)||Object.assign({},W)}function Ae(e,t){return _.set(e,t),_.get(e)}function b(){return be}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const q="https://content-firebaseappcheck.googleapis.com/v1",_e="exchangeRecaptchaV3Token",ye="exchangeDebugToken",O={RETRIAL_MIN_WAIT:30*1e3,RETRIAL_MAX_WAIT:960*1e3},Re=1440*60*1e3;/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class Ce{constructor(t,r,n,o,i){if(this.operation=t,this.retryPolicy=r,this.getWaitDuration=n,this.lowerBound=o,this.upperBound=i,this.pending=null,this.nextErrorWaitInterval=o,o>i)throw new Error("Proactive refresh lower bound greater than upper bound!")}start(){this.nextErrorWaitInterval=this.lowerBound,this.process(!0).catch(()=>{})}stop(){this.pending&&(this.pending.reject("cancelled"),this.pending=null)}isRunning(){return!!this.pending}async process(t){this.stop();try{this.pending=new m,this.pending.promise.catch(r=>{}),await Pe(this.getNextRun(t)),this.pending.resolve(),await this.pending.promise,this.pending=new m,this.pending.promise.catch(r=>{}),await this.operation(),this.pending.resolve(),await this.pending.promise,this.process(!0).catch(()=>{})}catch(r){this.retryPolicy(r)?this.process(!1).catch(()=>{}):this.stop()}}getNextRun(t){if(t)return this.nextErrorWaitInterval=this.lowerBound,this.getWaitDuration();{const r=this.nextErrorWaitInterval;return this.nextErrorWaitInterval*=2,this.nextErrorWaitInterval>this.upperBound&&(this.nextErrorWaitInterval=this.upperBound),r}}}function Pe(e){return new Promise(t=>{setTimeout(t,e)})}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const Se={"already-initialized":"You have already called initializeAppCheck() for FirebaseApp {$appName} with different options. To avoid this error, call initializeAppCheck() with the same options as when it was originally called. This will return the already initialized instance.","use-before-activation":"App Check is being used before initializeAppCheck() is called for FirebaseApp {$appName}. Call initializeAppCheck() before instantiating other Firebase services.","fetch-network-error":"Fetch failed to connect to a network. Check Internet connection. Original error: {$originalErrorMessage}.","fetch-parse-error":"Fetch client could not parse response. Original error: {$originalErrorMessage}.","fetch-status-error":"Fetch server returned an HTTP error status. HTTP status: {$httpStatus}.","storage-open":"Error thrown when opening storage. Original error: {$originalErrorMessage}.","storage-get":"Error thrown when reading from storage. Original error: {$originalErrorMessage}.","storage-set":"Error thrown when writing to storage. Original error: {$originalErrorMessage}.","recaptcha-error":"ReCAPTCHA error.",throttled:"Requests throttled due to {$httpStatus} error. Attempts allowed again after {$time}"},u=new ie("appCheck","AppCheck",Se);/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function M(e=!1){var t;return e?(t=self.grecaptcha)===null||t===void 0?void 0:t.enterprise:self.grecaptcha}function R(e){if(!l(e).activated)throw u.create("use-before-activation",{appName:e.name})}function j(e){const t=Math.round(e/1e3),r=Math.floor(t/(3600*24)),n=Math.floor((t-r*3600*24)/3600),o=Math.floor((t-r*3600*24-n*3600)/60),i=t-r*3600*24-n*3600-o*60;let s="";return r&&(s+=v(r)+"d:"),n&&(s+=v(n)+"h:"),s+=v(o)+"m:"+v(i)+"s",s}function v(e){return e===0?"00":e>=10?e.toString():"0"+e}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */async function C({url:e,body:t},r){const n={"Content-Type":"application/json"},o=r.getImmediate({optional:!0});if(o){const d=await o.getHeartbeatsHeader();d&&(n["X-Firebase-Client"]=d)}const i={method:"POST",body:JSON.stringify(t),headers:n};let s;try{s=await fetch(e,i)}catch(d){throw u.create("fetch-network-error",{originalErrorMessage:d?.message})}if(s.status!==200)throw u.create("fetch-status-error",{httpStatus:s.status});let c;try{c=await s.json()}catch(d){throw u.create("fetch-parse-error",{originalErrorMessage:d?.message})}const a=c.ttl.match(/^([\d.]+)(s)$/);if(!a||!a[2]||isNaN(Number(a[1])))throw u.create("fetch-parse-error",{originalErrorMessage:`ttl field (timeToLive) is not in standard Protobuf Duration format: ${c.ttl}`});const h=Number(a[1])*1e3,I=Date.now();return{token:c.token,expireTimeMillis:I+h,issuedAtTimeMillis:I}}function Ie(e,t){const{projectId:r,appId:n,apiKey:o}=e.options;return{url:`${q}/projects/${r}/apps/${n}:${_e}?key=${o}`,body:{recaptcha_v3_token:t}}}function G(e,t){const{projectId:r,appId:n,apiKey:o}=e.options;return{url:`${q}/projects/${r}/apps/${n}:${ye}?key=${o}`,body:{debug_token:t}}}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const De="firebase-app-check-database",Ne=1,g="firebase-app-check-store",V="debug-token";let E=null;function X(){return E||(E=new Promise((e,t)=>{try{const r=indexedDB.open(De,Ne);r.onsuccess=n=>{e(n.target.result)},r.onerror=n=>{var o;t(u.create("storage-open",{originalErrorMessage:(o=n.target.error)===null||o===void 0?void 0:o.message}))},r.onupgradeneeded=n=>{const o=n.target.result;switch(n.oldVersion){case 0:o.createObjectStore(g,{keyPath:"compositeKey"})}}}catch(r){t(u.create("storage-open",{originalErrorMessage:r?.message}))}}),E)}function xe(e){return J(Q(e))}function Oe(e,t){return Y(Q(e),t)}function Me(e){return Y(V,e)}function $e(){return J(V)}async function Y(e,t){const n=(await X()).transaction(g,"readwrite"),i=n.objectStore(g).put({compositeKey:e,value:t});return new Promise((s,c)=>{i.onsuccess=a=>{s()},n.onerror=a=>{var h;c(u.create("storage-set",{originalErrorMessage:(h=a.target.error)===null||h===void 0?void 0:h.message}))}})}async function J(e){const r=(await X()).transaction(g,"readonly"),o=r.objectStore(g).get(e);return new Promise((i,s)=>{o.onsuccess=c=>{const a=c.target.result;i(a?a.value:void 0)},r.onerror=c=>{var a;s(u.create("storage-get",{originalErrorMessage:(a=c.target.error)===null||a===void 0?void 0:a.message}))}})}function Q(e){return`${e.options.appId}-${e.name}`}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const p=new ce("@firebase/app-check");/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */async function He(e){if(K()){let t;try{t=await xe(e)}catch(r){p.warn(`Failed to read token from IndexedDB. Error: ${r}`)}return t}}function A(e,t){return K()?Oe(e,t).catch(r=>{p.warn(`Failed to write token to IndexedDB. Error: ${r}`)}):Promise.resolve()}async function Be(){let e;try{e=await $e()}catch{}if(e)return e;{const t=ae();return Me(t).catch(r=>p.warn(`Failed to persist debug token to IndexedDB. Error: ${r}`)),t}}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function P(){return b().enabled}async function S(){const e=b();if(e.enabled&&e.token)return e.token.promise;throw Error(`
            Can't get debug token in production mode.
        `)}function Le(){const e=se(),t=b();if(t.initialized=!0,typeof e.FIREBASE_APPCHECK_DEBUG_TOKEN!="string"&&e.FIREBASE_APPCHECK_DEBUG_TOKEN!==!0)return;t.enabled=!0;const r=new m;t.token=r,typeof e.FIREBASE_APPCHECK_DEBUG_TOKEN=="string"?r.resolve(e.FIREBASE_APPCHECK_DEBUG_TOKEN):r.resolve(Be())}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const Fe={error:"UNKNOWN_ERROR"};function Ke(e){return ue.encodeString(JSON.stringify(e),!1)}async function y(e,t=!1){const r=e.app;R(r);const n=l(r);let o=n.token,i;if(o&&!f(o)&&(n.token=void 0,o=void 0),!o){const a=await n.cachedTokenPromise;a&&(f(a)?o=a:await A(r,void 0))}if(!t&&o&&f(o))return{token:o.token};let s=!1;if(P()){n.exchangeTokenPromise||(n.exchangeTokenPromise=C(G(r,await S()),e.heartbeatServiceProvider).finally(()=>{n.exchangeTokenPromise=void 0}),s=!0);const a=await n.exchangeTokenPromise;return await A(r,a),n.token=a,{token:a.token}}try{n.exchangeTokenPromise||(n.exchangeTokenPromise=n.provider.getToken().finally(()=>{n.exchangeTokenPromise=void 0}),s=!0),o=await l(r).exchangeTokenPromise}catch(a){a.code==="appCheck/throttled"?p.warn(a.message):p.error(a),i=a}let c;return o?i?f(o)?c={token:o.token,internalError:i}:c=H(i):(c={token:o.token},n.token=o,await A(r,o)):c=H(i),s&&te(r,c),c}async function Ue(e){const t=e.app;R(t);const{provider:r}=l(t);if(P()){const n=await S(),{token:o}=await C(G(t,n),e.heartbeatServiceProvider);return{token:o}}else{const{token:n}=await r.getToken();return{token:n}}}function Z(e,t,r,n){const{app:o}=e,i=l(o),s={next:r,error:n,type:t};if(i.tokenObservers=[...i.tokenObservers,s],i.token&&f(i.token)){const c=i.token;Promise.resolve().then(()=>{r({token:c.token}),$(e)}).catch(()=>{})}i.cachedTokenPromise.then(()=>$(e))}function ee(e,t){const r=l(e),n=r.tokenObservers.filter(o=>o.next!==t);n.length===0&&r.tokenRefresher&&r.tokenRefresher.isRunning()&&r.tokenRefresher.stop(),r.tokenObservers=n}function $(e){const{app:t}=e,r=l(t);let n=r.tokenRefresher;n||(n=ze(e),r.tokenRefresher=n),!n.isRunning()&&r.isTokenAutoRefreshEnabled&&n.start()}function ze(e){const{app:t}=e;return new Ce(async()=>{const r=l(t);let n;if(r.token?n=await y(e,!0):n=await y(e),n.error)throw n.error;if(n.internalError)throw n.internalError},()=>!0,()=>{const r=l(t);if(r.token){let n=r.token.issuedAtTimeMillis+(r.token.expireTimeMillis-r.token.issuedAtTimeMillis)*.5+3e5;const o=r.token.expireTimeMillis-300*1e3;return n=Math.min(n,o),Math.max(0,n-Date.now())}else return 0},O.RETRIAL_MIN_WAIT,O.RETRIAL_MAX_WAIT)}function te(e,t){const r=l(e).tokenObservers;for(const n of r)try{n.type==="EXTERNAL"&&t.error!=null?n.error(t.error):n.next(t)}catch{}}function f(e){return e.expireTimeMillis-Date.now()>0}function H(e){return{token:Ke(Fe),error:e}}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class We{constructor(t,r){this.app=t,this.heartbeatServiceProvider=r}_delete(){const{tokenObservers:t}=l(this.app);for(const r of t)ee(this.app,r.next);return Promise.resolve()}}function qe(e,t){return new We(e,t)}function je(e){return{getToken:t=>y(e,t),getLimitedUseToken:()=>Ue(e),addTokenListener:t=>Z(e,"INTERNAL",t),removeTokenListener:t=>ee(e.app,t)}}const Ge="@firebase/app-check",Ve="0.8.6";/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function Xe(e,t){const r=new m,n=l(e);n.reCAPTCHAState={initialized:r};const o=Ye(e),i=M(!1);return i?B(e,t,i,o,r):Ze(()=>{const s=M(!1);if(!s)throw new Error("no recaptcha");B(e,t,s,o,r)}),r.promise}function B(e,t,r,n,o){r.ready(()=>{Qe(e,t,r,n),o.resolve(r)})}function Ye(e){const t=`fire_app_check_${e.name}`,r=document.createElement("div");return r.id=t,r.style.display="none",document.body.appendChild(r),t}async function Je(e){R(e);const r=await l(e).reCAPTCHAState.initialized.promise;return new Promise((n,o)=>{const i=l(e).reCAPTCHAState;r.ready(()=>{n(r.execute(i.widgetId,{action:"fire_app_check"}))})})}function Qe(e,t,r,n){const o=r.render(n,{sitekey:t,size:"invisible",callback:()=>{l(e).reCAPTCHAState.succeeded=!0},"error-callback":()=>{l(e).reCAPTCHAState.succeeded=!1}}),i=l(e);i.reCAPTCHAState=Object.assign(Object.assign({},i.reCAPTCHAState),{widgetId:o})}function Ze(e){const t=document.createElement("script");me(t,Te`https://www.google.com/recaptcha/api.js`),t.onload=e,document.head.appendChild(t)}/**
 * @license
 * Copyright 2021 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class re{constructor(t){this._siteKey=t,this._throttleData=null}async getToken(){var t,r,n;tt(this._throttleData);const o=await Je(this._app).catch(s=>{throw u.create("recaptcha-error")});if(!(!((t=l(this._app).reCAPTCHAState)===null||t===void 0)&&t.succeeded))throw u.create("recaptcha-error");let i;try{i=await C(Ie(this._app,o),this._heartbeatServiceProvider)}catch(s){throw!((r=s.code)===null||r===void 0)&&r.includes("fetch-status-error")?(this._throttleData=et(Number((n=s.customData)===null||n===void 0?void 0:n.httpStatus),this._throttleData),u.create("throttled",{time:j(this._throttleData.allowRequestsAfter-Date.now()),httpStatus:this._throttleData.httpStatus})):s}return this._throttleData=null,i}initialize(t){this._app=t,this._heartbeatServiceProvider=F(t,"heartbeat"),Xe(t,this._siteKey).catch(()=>{})}isEqual(t){return t instanceof re?this._siteKey===t._siteKey:!1}}function et(e,t){if(e===404||e===403)return{backoffCount:1,allowRequestsAfter:Date.now()+Re,httpStatus:e};{const r=t?t.backoffCount:0,n=le(r,1e3,2);return{backoffCount:r+1,allowRequestsAfter:Date.now()+n,httpStatus:e}}}function tt(e){if(e&&Date.now()-e.allowRequestsAfter<=0)throw u.create("throttled",{time:j(e.allowRequestsAfter-Date.now()),httpStatus:e.httpStatus})}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function st(e=ne(),t){e=oe(e);const r=F(e,"app-check");if(b().initialized||Le(),P()&&S().then(o=>console.log(`App Check debug token: ${o}. You will need to add it to your app's App Check settings in the Firebase console for it to work.`)),r.isInitialized()){const o=r.getImmediate(),i=r.getOptions();if(i.isTokenAutoRefreshEnabled===t.isTokenAutoRefreshEnabled&&i.provider.isEqual(t.provider))return o;throw u.create("already-initialized",{appName:e.name})}const n=r.initialize({options:t});return rt(e,t.provider,t.isTokenAutoRefreshEnabled),l(e).isTokenAutoRefreshEnabled&&Z(n,"INTERNAL",()=>{}),n}function rt(e,t,r){const n=Ae(e,Object.assign({},W));n.activated=!0,n.provider=t,n.cachedTokenPromise=He(e).then(o=>(o&&f(o)&&(n.token=o,te(e,{token:o.token})),o)),n.isTokenAutoRefreshEnabled=r===void 0?e.automaticDataCollectionEnabled:r,n.provider.initialize(e)}const nt="app-check",L="app-check-internal";function ot(){D(new N(nt,e=>{const t=e.getProvider("app").getImmediate(),r=e.getProvider("heartbeat");return qe(t,r)},"PUBLIC").setInstantiationMode("EXPLICIT").setInstanceCreatedCallback((e,t,r)=>{e.getProvider(L).initialize()})),D(new N(L,e=>{const t=e.getProvider("app-check").getImmediate();return je(t)},"PUBLIC").setInstantiationMode("EXPLICIT")),de(Ge,Ve)}ot();export{re as ReCaptchaV3Provider,st as initializeAppCheck};
