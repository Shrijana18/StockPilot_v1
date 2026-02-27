var Ja={};/**
 * @license
 * Copyright 2017 Google LLC
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
 */const lu=function(n){const e=[];let t=0;for(let r=0;r<n.length;r++){let i=n.charCodeAt(r);i<128?e[t++]=i:i<2048?(e[t++]=i>>6|192,e[t++]=i&63|128):(i&64512)===55296&&r+1<n.length&&(n.charCodeAt(r+1)&64512)===56320?(i=65536+((i&1023)<<10)+(n.charCodeAt(++r)&1023),e[t++]=i>>18|240,e[t++]=i>>12&63|128,e[t++]=i>>6&63|128,e[t++]=i&63|128):(e[t++]=i>>12|224,e[t++]=i>>6&63|128,e[t++]=i&63|128)}return e},gd=function(n){const e=[];let t=0,r=0;for(;t<n.length;){const i=n[t++];if(i<128)e[r++]=String.fromCharCode(i);else if(i>191&&i<224){const o=n[t++];e[r++]=String.fromCharCode((i&31)<<6|o&63)}else if(i>239&&i<365){const o=n[t++],a=n[t++],u=n[t++],l=((i&7)<<18|(o&63)<<12|(a&63)<<6|u&63)-65536;e[r++]=String.fromCharCode(55296+(l>>10)),e[r++]=String.fromCharCode(56320+(l&1023))}else{const o=n[t++],a=n[t++];e[r++]=String.fromCharCode((i&15)<<12|(o&63)<<6|a&63)}}return e.join("")},hu={byteToCharMap_:null,charToByteMap_:null,byteToCharMapWebSafe_:null,charToByteMapWebSafe_:null,ENCODED_VALS_BASE:"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789",get ENCODED_VALS(){return this.ENCODED_VALS_BASE+"+/="},get ENCODED_VALS_WEBSAFE(){return this.ENCODED_VALS_BASE+"-_."},HAS_NATIVE_SUPPORT:typeof atob=="function",encodeByteArray(n,e){if(!Array.isArray(n))throw Error("encodeByteArray takes an array as a parameter");this.init_();const t=e?this.byteToCharMapWebSafe_:this.byteToCharMap_,r=[];for(let i=0;i<n.length;i+=3){const o=n[i],a=i+1<n.length,u=a?n[i+1]:0,l=i+2<n.length,d=l?n[i+2]:0,p=o>>2,y=(o&3)<<4|u>>4;let T=(u&15)<<2|d>>6,S=d&63;l||(S=64,a||(T=64)),r.push(t[p],t[y],t[T],t[S])}return r.join("")},encodeString(n,e){return this.HAS_NATIVE_SUPPORT&&!e?btoa(n):this.encodeByteArray(lu(n),e)},decodeString(n,e){return this.HAS_NATIVE_SUPPORT&&!e?atob(n):gd(this.decodeStringToByteArray(n,e))},decodeStringToByteArray(n,e){this.init_();const t=e?this.charToByteMapWebSafe_:this.charToByteMap_,r=[];for(let i=0;i<n.length;){const o=t[n.charAt(i++)],u=i<n.length?t[n.charAt(i)]:0;++i;const d=i<n.length?t[n.charAt(i)]:64;++i;const y=i<n.length?t[n.charAt(i)]:64;if(++i,o==null||u==null||d==null||y==null)throw new _d;const T=o<<2|u>>4;if(r.push(T),d!==64){const S=u<<4&240|d>>2;if(r.push(S),y!==64){const V=d<<6&192|y;r.push(V)}}}return r},init_(){if(!this.byteToCharMap_){this.byteToCharMap_={},this.charToByteMap_={},this.byteToCharMapWebSafe_={},this.charToByteMapWebSafe_={};for(let n=0;n<this.ENCODED_VALS.length;n++)this.byteToCharMap_[n]=this.ENCODED_VALS.charAt(n),this.charToByteMap_[this.byteToCharMap_[n]]=n,this.byteToCharMapWebSafe_[n]=this.ENCODED_VALS_WEBSAFE.charAt(n),this.charToByteMapWebSafe_[this.byteToCharMapWebSafe_[n]]=n,n>=this.ENCODED_VALS_BASE.length&&(this.charToByteMap_[this.ENCODED_VALS_WEBSAFE.charAt(n)]=n,this.charToByteMapWebSafe_[this.ENCODED_VALS.charAt(n)]=n)}}};class _d extends Error{constructor(){super(...arguments),this.name="DecodeBase64StringError"}}const yd=function(n){const e=lu(n);return hu.encodeByteArray(e,!0)},si=function(n){return yd(n).replace(/\./g,"")},du=function(n){try{return hu.decodeString(n,!0)}catch(e){console.error("base64Decode failed: ",e)}return null};/**
 * @license
 * Copyright 2022 Google LLC
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
 */function vd(){if(typeof self<"u")return self;if(typeof window<"u")return window;if(typeof global<"u")return global;throw new Error("Unable to locate global object.")}/**
 * @license
 * Copyright 2022 Google LLC
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
 */const Ed=()=>vd().__FIREBASE_DEFAULTS__,Id=()=>{if(typeof process>"u"||typeof Ja>"u")return;const n=Ja.__FIREBASE_DEFAULTS__;if(n)return JSON.parse(n)},Td=()=>{if(typeof document>"u")return;let n;try{n=document.cookie.match(/__FIREBASE_DEFAULTS__=([^;]+)/)}catch{return}const e=n&&du(n[1]);return e&&JSON.parse(e)},Ei=()=>{try{return Ed()||Id()||Td()}catch(n){console.info(`Unable to get __FIREBASE_DEFAULTS__ due to: ${n}`);return}},fu=n=>{var e,t;return(t=(e=Ei())===null||e===void 0?void 0:e.emulatorHosts)===null||t===void 0?void 0:t[n]},wd=n=>{const e=fu(n);if(!e)return;const t=e.lastIndexOf(":");if(t<=0||t+1===e.length)throw new Error(`Invalid host ${e} with no separate hostname and port!`);const r=parseInt(e.substring(t+1),10);return e[0]==="["?[e.substring(1,t-1),r]:[e.substring(0,t),r]},pu=()=>{var n;return(n=Ei())===null||n===void 0?void 0:n.config},mu=n=>{var e;return(e=Ei())===null||e===void 0?void 0:e[`_${n}`]};/**
 * @license
 * Copyright 2017 Google LLC
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
 */class Ad{constructor(){this.reject=()=>{},this.resolve=()=>{},this.promise=new Promise((e,t)=>{this.resolve=e,this.reject=t})}wrapCallback(e){return(t,r)=>{t?this.reject(t):this.resolve(r),typeof e=="function"&&(this.promise.catch(()=>{}),e.length===1?e(t):e(t,r))}}}/**
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
 */function Rd(n,e){if(n.uid)throw new Error('The "uid" field is no longer supported by mockUserToken. Please use "sub" instead for Firebase Auth User ID.');const t={alg:"none",type:"JWT"},r=e||"demo-project",i=n.iat||0,o=n.sub||n.user_id;if(!o)throw new Error("mockUserToken must contain 'sub' or 'user_id' field!");const a=Object.assign({iss:`https://securetoken.google.com/${r}`,aud:r,iat:i,exp:i+3600,auth_time:i,sub:o,user_id:o,firebase:{sign_in_provider:"custom",identities:{}}},n);return[si(JSON.stringify(t)),si(JSON.stringify(a)),""].join(".")}/**
 * @license
 * Copyright 2017 Google LLC
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
 */function ge(){return typeof navigator<"u"&&typeof navigator.userAgent=="string"?navigator.userAgent:""}function Pd(){return typeof window<"u"&&!!(window.cordova||window.phonegap||window.PhoneGap)&&/ios|iphone|ipod|ipad|android|blackberry|iemobile/i.test(ge())}function Sd(){var n;const e=(n=Ei())===null||n===void 0?void 0:n.forceEnvironment;if(e==="node")return!0;if(e==="browser")return!1;try{return Object.prototype.toString.call(global.process)==="[object process]"}catch{return!1}}function Cd(){const n=typeof chrome=="object"?chrome.runtime:typeof browser=="object"?browser.runtime:void 0;return typeof n=="object"&&n.id!==void 0}function bd(){return typeof navigator=="object"&&navigator.product==="ReactNative"}function kd(){const n=ge();return n.indexOf("MSIE ")>=0||n.indexOf("Trident/")>=0}function Dd(){return!Sd()&&!!navigator.userAgent&&navigator.userAgent.includes("Safari")&&!navigator.userAgent.includes("Chrome")}function Vd(){try{return typeof indexedDB=="object"}catch{return!1}}function Nd(){return new Promise((n,e)=>{try{let t=!0;const r="validate-browser-context-for-indexeddb-analytics-module",i=self.indexedDB.open(r);i.onsuccess=()=>{i.result.close(),t||self.indexedDB.deleteDatabase(r),n(!0)},i.onupgradeneeded=()=>{t=!1},i.onerror=()=>{var o;e(((o=i.error)===null||o===void 0?void 0:o.message)||"")}}catch(t){e(t)}})}/**
 * @license
 * Copyright 2017 Google LLC
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
 */const Od="FirebaseError";class at extends Error{constructor(e,t,r){super(t),this.code=e,this.customData=r,this.name=Od,Object.setPrototypeOf(this,at.prototype),Error.captureStackTrace&&Error.captureStackTrace(this,fr.prototype.create)}}class fr{constructor(e,t,r){this.service=e,this.serviceName=t,this.errors=r}create(e,...t){const r=t[0]||{},i=`${this.service}/${e}`,o=this.errors[e],a=o?Md(o,r):"Error",u=`${this.serviceName}: ${a} (${i}).`;return new at(i,u,r)}}function Md(n,e){return n.replace(Ld,(t,r)=>{const i=e[r];return i!=null?String(i):`<${r}?>`})}const Ld=/\{\$([^}]+)}/g;function xd(n){for(const e in n)if(Object.prototype.hasOwnProperty.call(n,e))return!1;return!0}function an(n,e){if(n===e)return!0;const t=Object.keys(n),r=Object.keys(e);for(const i of t){if(!r.includes(i))return!1;const o=n[i],a=e[i];if(Za(o)&&Za(a)){if(!an(o,a))return!1}else if(o!==a)return!1}for(const i of r)if(!t.includes(i))return!1;return!0}function Za(n){return n!==null&&typeof n=="object"}/**
 * @license
 * Copyright 2017 Google LLC
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
 */function pr(n){const e=[];for(const[t,r]of Object.entries(n))Array.isArray(r)?r.forEach(i=>{e.push(encodeURIComponent(t)+"="+encodeURIComponent(i))}):e.push(encodeURIComponent(t)+"="+encodeURIComponent(r));return e.length?"&"+e.join("&"):""}function Wn(n){const e={};return n.replace(/^\?/,"").split("&").forEach(r=>{if(r){const[i,o]=r.split("=");e[decodeURIComponent(i)]=decodeURIComponent(o)}}),e}function Gn(n){const e=n.indexOf("?");if(!e)return"";const t=n.indexOf("#",e);return n.substring(e,t>0?t:void 0)}function Fd(n,e){const t=new Ud(n,e);return t.subscribe.bind(t)}class Ud{constructor(e,t){this.observers=[],this.unsubscribes=[],this.observerCount=0,this.task=Promise.resolve(),this.finalized=!1,this.onNoObservers=t,this.task.then(()=>{e(this)}).catch(r=>{this.error(r)})}next(e){this.forEachObserver(t=>{t.next(e)})}error(e){this.forEachObserver(t=>{t.error(e)}),this.close(e)}complete(){this.forEachObserver(e=>{e.complete()}),this.close()}subscribe(e,t,r){let i;if(e===void 0&&t===void 0&&r===void 0)throw new Error("Missing Observer.");Bd(e,["next","error","complete"])?i=e:i={next:e,error:t,complete:r},i.next===void 0&&(i.next=Ts),i.error===void 0&&(i.error=Ts),i.complete===void 0&&(i.complete=Ts);const o=this.unsubscribeOne.bind(this,this.observers.length);return this.finalized&&this.task.then(()=>{try{this.finalError?i.error(this.finalError):i.complete()}catch{}}),this.observers.push(i),o}unsubscribeOne(e){this.observers===void 0||this.observers[e]===void 0||(delete this.observers[e],this.observerCount-=1,this.observerCount===0&&this.onNoObservers!==void 0&&this.onNoObservers(this))}forEachObserver(e){if(!this.finalized)for(let t=0;t<this.observers.length;t++)this.sendOne(t,e)}sendOne(e,t){this.task.then(()=>{if(this.observers!==void 0&&this.observers[e]!==void 0)try{t(this.observers[e])}catch(r){typeof console<"u"&&console.error&&console.error(r)}})}close(e){this.finalized||(this.finalized=!0,e!==void 0&&(this.finalError=e),this.task.then(()=>{this.observers=void 0,this.onNoObservers=void 0}))}}function Bd(n,e){if(typeof n!="object"||n===null)return!1;for(const t of e)if(t in n&&typeof n[t]=="function")return!0;return!1}function Ts(){}/**
 * @license
 * Copyright 2022 Google LLC
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
 */const Vv=function(){return"xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g,n=>{const e=Math.random()*16|0;return(n==="x"?e:e&3|8).toString(16)})};/**
 * @license
 * Copyright 2019 Google LLC
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
 */const qd=1e3,jd=2,$d=14400*1e3,zd=.5;function Nv(n,e=qd,t=jd){const r=e*Math.pow(t,n),i=Math.round(zd*r*(Math.random()-.5)*2);return Math.min($d,r+i)}/**
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
 */function Q(n){return n&&n._delegate?n._delegate:n}class Nt{constructor(e,t,r){this.name=e,this.instanceFactory=t,this.type=r,this.multipleInstances=!1,this.serviceProps={},this.instantiationMode="LAZY",this.onInstanceCreated=null}setInstantiationMode(e){return this.instantiationMode=e,this}setMultipleInstances(e){return this.multipleInstances=e,this}setServiceProps(e){return this.serviceProps=e,this}setInstanceCreatedCallback(e){return this.onInstanceCreated=e,this}}/**
 * @license
 * Copyright 2019 Google LLC
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
 */const bt="[DEFAULT]";/**
 * @license
 * Copyright 2019 Google LLC
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
 */class Wd{constructor(e,t){this.name=e,this.container=t,this.component=null,this.instances=new Map,this.instancesDeferred=new Map,this.instancesOptions=new Map,this.onInitCallbacks=new Map}get(e){const t=this.normalizeInstanceIdentifier(e);if(!this.instancesDeferred.has(t)){const r=new Ad;if(this.instancesDeferred.set(t,r),this.isInitialized(t)||this.shouldAutoInitialize())try{const i=this.getOrInitializeService({instanceIdentifier:t});i&&r.resolve(i)}catch{}}return this.instancesDeferred.get(t).promise}getImmediate(e){var t;const r=this.normalizeInstanceIdentifier(e?.identifier),i=(t=e?.optional)!==null&&t!==void 0?t:!1;if(this.isInitialized(r)||this.shouldAutoInitialize())try{return this.getOrInitializeService({instanceIdentifier:r})}catch(o){if(i)return null;throw o}else{if(i)return null;throw Error(`Service ${this.name} is not available`)}}getComponent(){return this.component}setComponent(e){if(e.name!==this.name)throw Error(`Mismatching Component ${e.name} for Provider ${this.name}.`);if(this.component)throw Error(`Component for ${this.name} has already been provided`);if(this.component=e,!!this.shouldAutoInitialize()){if(Hd(e))try{this.getOrInitializeService({instanceIdentifier:bt})}catch{}for(const[t,r]of this.instancesDeferred.entries()){const i=this.normalizeInstanceIdentifier(t);try{const o=this.getOrInitializeService({instanceIdentifier:i});r.resolve(o)}catch{}}}}clearInstance(e=bt){this.instancesDeferred.delete(e),this.instancesOptions.delete(e),this.instances.delete(e)}async delete(){const e=Array.from(this.instances.values());await Promise.all([...e.filter(t=>"INTERNAL"in t).map(t=>t.INTERNAL.delete()),...e.filter(t=>"_delete"in t).map(t=>t._delete())])}isComponentSet(){return this.component!=null}isInitialized(e=bt){return this.instances.has(e)}getOptions(e=bt){return this.instancesOptions.get(e)||{}}initialize(e={}){const{options:t={}}=e,r=this.normalizeInstanceIdentifier(e.instanceIdentifier);if(this.isInitialized(r))throw Error(`${this.name}(${r}) has already been initialized`);if(!this.isComponentSet())throw Error(`Component ${this.name} has not been registered yet`);const i=this.getOrInitializeService({instanceIdentifier:r,options:t});for(const[o,a]of this.instancesDeferred.entries()){const u=this.normalizeInstanceIdentifier(o);r===u&&a.resolve(i)}return i}onInit(e,t){var r;const i=this.normalizeInstanceIdentifier(t),o=(r=this.onInitCallbacks.get(i))!==null&&r!==void 0?r:new Set;o.add(e),this.onInitCallbacks.set(i,o);const a=this.instances.get(i);return a&&e(a,i),()=>{o.delete(e)}}invokeOnInitCallbacks(e,t){const r=this.onInitCallbacks.get(t);if(r)for(const i of r)try{i(e,t)}catch{}}getOrInitializeService({instanceIdentifier:e,options:t={}}){let r=this.instances.get(e);if(!r&&this.component&&(r=this.component.instanceFactory(this.container,{instanceIdentifier:Gd(e),options:t}),this.instances.set(e,r),this.instancesOptions.set(e,t),this.invokeOnInitCallbacks(r,e),this.component.onInstanceCreated))try{this.component.onInstanceCreated(this.container,e,r)}catch{}return r||null}normalizeInstanceIdentifier(e=bt){return this.component?this.component.multipleInstances?e:bt:e}shouldAutoInitialize(){return!!this.component&&this.component.instantiationMode!=="EXPLICIT"}}function Gd(n){return n===bt?void 0:n}function Hd(n){return n.instantiationMode==="EAGER"}/**
 * @license
 * Copyright 2019 Google LLC
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
 */class Kd{constructor(e){this.name=e,this.providers=new Map}addComponent(e){const t=this.getProvider(e.name);if(t.isComponentSet())throw new Error(`Component ${e.name} has already been registered with ${this.name}`);t.setComponent(e)}addOrOverwriteComponent(e){this.getProvider(e.name).isComponentSet()&&this.providers.delete(e.name),this.addComponent(e)}getProvider(e){if(this.providers.has(e))return this.providers.get(e);const t=new Wd(e,this);return this.providers.set(e,t),t}getProviders(){return Array.from(this.providers.values())}}/**
 * @license
 * Copyright 2017 Google LLC
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
 */var j;(function(n){n[n.DEBUG=0]="DEBUG",n[n.VERBOSE=1]="VERBOSE",n[n.INFO=2]="INFO",n[n.WARN=3]="WARN",n[n.ERROR=4]="ERROR",n[n.SILENT=5]="SILENT"})(j||(j={}));const Qd={debug:j.DEBUG,verbose:j.VERBOSE,info:j.INFO,warn:j.WARN,error:j.ERROR,silent:j.SILENT},Yd=j.INFO,Xd={[j.DEBUG]:"log",[j.VERBOSE]:"log",[j.INFO]:"info",[j.WARN]:"warn",[j.ERROR]:"error"},Jd=(n,e,...t)=>{if(e<n.logLevel)return;const r=new Date().toISOString(),i=Xd[e];if(i)console[i](`[${r}]  ${n.name}:`,...t);else throw new Error(`Attempted to log a message with an invalid logType (value: ${e})`)};class eo{constructor(e){this.name=e,this._logLevel=Yd,this._logHandler=Jd,this._userLogHandler=null}get logLevel(){return this._logLevel}set logLevel(e){if(!(e in j))throw new TypeError(`Invalid value "${e}" assigned to \`logLevel\``);this._logLevel=e}setLogLevel(e){this._logLevel=typeof e=="string"?Qd[e]:e}get logHandler(){return this._logHandler}set logHandler(e){if(typeof e!="function")throw new TypeError("Value assigned to `logHandler` must be a function");this._logHandler=e}get userLogHandler(){return this._userLogHandler}set userLogHandler(e){this._userLogHandler=e}debug(...e){this._userLogHandler&&this._userLogHandler(this,j.DEBUG,...e),this._logHandler(this,j.DEBUG,...e)}log(...e){this._userLogHandler&&this._userLogHandler(this,j.VERBOSE,...e),this._logHandler(this,j.VERBOSE,...e)}info(...e){this._userLogHandler&&this._userLogHandler(this,j.INFO,...e),this._logHandler(this,j.INFO,...e)}warn(...e){this._userLogHandler&&this._userLogHandler(this,j.WARN,...e),this._logHandler(this,j.WARN,...e)}error(...e){this._userLogHandler&&this._userLogHandler(this,j.ERROR,...e),this._logHandler(this,j.ERROR,...e)}}const Zd=(n,e)=>e.some(t=>n instanceof t);let ec,tc;function ef(){return ec||(ec=[IDBDatabase,IDBObjectStore,IDBIndex,IDBCursor,IDBTransaction])}function tf(){return tc||(tc=[IDBCursor.prototype.advance,IDBCursor.prototype.continue,IDBCursor.prototype.continuePrimaryKey])}const gu=new WeakMap,Vs=new WeakMap,_u=new WeakMap,ws=new WeakMap,to=new WeakMap;function nf(n){const e=new Promise((t,r)=>{const i=()=>{n.removeEventListener("success",o),n.removeEventListener("error",a)},o=()=>{t(gt(n.result)),i()},a=()=>{r(n.error),i()};n.addEventListener("success",o),n.addEventListener("error",a)});return e.then(t=>{t instanceof IDBCursor&&gu.set(t,n)}).catch(()=>{}),to.set(e,n),e}function rf(n){if(Vs.has(n))return;const e=new Promise((t,r)=>{const i=()=>{n.removeEventListener("complete",o),n.removeEventListener("error",a),n.removeEventListener("abort",a)},o=()=>{t(),i()},a=()=>{r(n.error||new DOMException("AbortError","AbortError")),i()};n.addEventListener("complete",o),n.addEventListener("error",a),n.addEventListener("abort",a)});Vs.set(n,e)}let Ns={get(n,e,t){if(n instanceof IDBTransaction){if(e==="done")return Vs.get(n);if(e==="objectStoreNames")return n.objectStoreNames||_u.get(n);if(e==="store")return t.objectStoreNames[1]?void 0:t.objectStore(t.objectStoreNames[0])}return gt(n[e])},set(n,e,t){return n[e]=t,!0},has(n,e){return n instanceof IDBTransaction&&(e==="done"||e==="store")?!0:e in n}};function sf(n){Ns=n(Ns)}function of(n){return n===IDBDatabase.prototype.transaction&&!("objectStoreNames"in IDBTransaction.prototype)?function(e,...t){const r=n.call(As(this),e,...t);return _u.set(r,e.sort?e.sort():[e]),gt(r)}:tf().includes(n)?function(...e){return n.apply(As(this),e),gt(gu.get(this))}:function(...e){return gt(n.apply(As(this),e))}}function af(n){return typeof n=="function"?of(n):(n instanceof IDBTransaction&&rf(n),Zd(n,ef())?new Proxy(n,Ns):n)}function gt(n){if(n instanceof IDBRequest)return nf(n);if(ws.has(n))return ws.get(n);const e=af(n);return e!==n&&(ws.set(n,e),to.set(e,n)),e}const As=n=>to.get(n);function cf(n,e,{blocked:t,upgrade:r,blocking:i,terminated:o}={}){const a=indexedDB.open(n,e),u=gt(a);return r&&a.addEventListener("upgradeneeded",l=>{r(gt(a.result),l.oldVersion,l.newVersion,gt(a.transaction),l)}),t&&a.addEventListener("blocked",l=>t(l.oldVersion,l.newVersion,l)),u.then(l=>{o&&l.addEventListener("close",()=>o()),i&&l.addEventListener("versionchange",d=>i(d.oldVersion,d.newVersion,d))}).catch(()=>{}),u}const uf=["get","getKey","getAll","getAllKeys","count"],lf=["put","add","delete","clear"],Rs=new Map;function nc(n,e){if(!(n instanceof IDBDatabase&&!(e in n)&&typeof e=="string"))return;if(Rs.get(e))return Rs.get(e);const t=e.replace(/FromIndex$/,""),r=e!==t,i=lf.includes(t);if(!(t in(r?IDBIndex:IDBObjectStore).prototype)||!(i||uf.includes(t)))return;const o=async function(a,...u){const l=this.transaction(a,i?"readwrite":"readonly");let d=l.store;return r&&(d=d.index(u.shift())),(await Promise.all([d[t](...u),i&&l.done]))[0]};return Rs.set(e,o),o}sf(n=>({...n,get:(e,t,r)=>nc(e,t)||n.get(e,t,r),has:(e,t)=>!!nc(e,t)||n.has(e,t)}));/**
 * @license
 * Copyright 2019 Google LLC
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
 */class hf{constructor(e){this.container=e}getPlatformInfoString(){return this.container.getProviders().map(t=>{if(df(t)){const r=t.getImmediate();return`${r.library}/${r.version}`}else return null}).filter(t=>t).join(" ")}}function df(n){const e=n.getComponent();return e?.type==="VERSION"}const Os="@firebase/app",rc="0.10.7";/**
 * @license
 * Copyright 2019 Google LLC
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
 */const Ot=new eo("@firebase/app"),ff="@firebase/app-compat",pf="@firebase/analytics-compat",mf="@firebase/analytics",gf="@firebase/app-check-compat",_f="@firebase/app-check",yf="@firebase/auth",vf="@firebase/auth-compat",Ef="@firebase/database",If="@firebase/database-compat",Tf="@firebase/functions",wf="@firebase/functions-compat",Af="@firebase/installations",Rf="@firebase/installations-compat",Pf="@firebase/messaging",Sf="@firebase/messaging-compat",Cf="@firebase/performance",bf="@firebase/performance-compat",kf="@firebase/remote-config",Df="@firebase/remote-config-compat",Vf="@firebase/storage",Nf="@firebase/storage-compat",Of="@firebase/firestore",Mf="@firebase/vertexai-preview",Lf="@firebase/firestore-compat",xf="firebase",Ff="10.12.4";/**
 * @license
 * Copyright 2019 Google LLC
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
 */const Ms="[DEFAULT]",Uf={[Os]:"fire-core",[ff]:"fire-core-compat",[mf]:"fire-analytics",[pf]:"fire-analytics-compat",[_f]:"fire-app-check",[gf]:"fire-app-check-compat",[yf]:"fire-auth",[vf]:"fire-auth-compat",[Ef]:"fire-rtdb",[If]:"fire-rtdb-compat",[Tf]:"fire-fn",[wf]:"fire-fn-compat",[Af]:"fire-iid",[Rf]:"fire-iid-compat",[Pf]:"fire-fcm",[Sf]:"fire-fcm-compat",[Cf]:"fire-perf",[bf]:"fire-perf-compat",[kf]:"fire-rc",[Df]:"fire-rc-compat",[Vf]:"fire-gcs",[Nf]:"fire-gcs-compat",[Of]:"fire-fst",[Lf]:"fire-fst-compat",[Mf]:"fire-vertex","fire-js":"fire-js",[xf]:"fire-js-all"};/**
 * @license
 * Copyright 2019 Google LLC
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
 */const rr=new Map,Bf=new Map,Ls=new Map;function ic(n,e){try{n.container.addComponent(e)}catch(t){Ot.debug(`Component ${e.name} failed to register with FirebaseApp ${n.name}`,t)}}function cn(n){const e=n.name;if(Ls.has(e))return Ot.debug(`There were multiple attempts to register component ${e}.`),!1;Ls.set(e,n);for(const t of rr.values())ic(t,n);for(const t of Bf.values())ic(t,n);return!0}function Ii(n,e){const t=n.container.getProvider("heartbeat").getImmediate({optional:!0});return t&&t.triggerHeartbeat(),n.container.getProvider(e)}function Ce(n){return n.settings!==void 0}/**
 * @license
 * Copyright 2019 Google LLC
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
 */const qf={"no-app":"No Firebase App '{$appName}' has been created - call initializeApp() first","bad-app-name":"Illegal App name: '{$appName}'","duplicate-app":"Firebase App named '{$appName}' already exists with different options or config","app-deleted":"Firebase App named '{$appName}' already deleted","server-app-deleted":"Firebase Server App has been deleted","no-options":"Need to provide options, when not being deployed to hosting via source.","invalid-app-argument":"firebase.{$appName}() takes either no argument or a Firebase App instance.","invalid-log-argument":"First argument to `onLog` must be null or a function.","idb-open":"Error thrown when opening IndexedDB. Original error: {$originalErrorMessage}.","idb-get":"Error thrown when reading from IndexedDB. Original error: {$originalErrorMessage}.","idb-set":"Error thrown when writing to IndexedDB. Original error: {$originalErrorMessage}.","idb-delete":"Error thrown when deleting from IndexedDB. Original error: {$originalErrorMessage}.","finalization-registry-not-supported":"FirebaseServerApp deleteOnDeref field defined but the JS runtime does not support FinalizationRegistry.","invalid-server-app-environment":"FirebaseServerApp is not for use in browser environments."},_t=new fr("app","Firebase",qf);/**
 * @license
 * Copyright 2019 Google LLC
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
 */class jf{constructor(e,t,r){this._isDeleted=!1,this._options=Object.assign({},e),this._config=Object.assign({},t),this._name=t.name,this._automaticDataCollectionEnabled=t.automaticDataCollectionEnabled,this._container=r,this.container.addComponent(new Nt("app",()=>this,"PUBLIC"))}get automaticDataCollectionEnabled(){return this.checkDestroyed(),this._automaticDataCollectionEnabled}set automaticDataCollectionEnabled(e){this.checkDestroyed(),this._automaticDataCollectionEnabled=e}get name(){return this.checkDestroyed(),this._name}get options(){return this.checkDestroyed(),this._options}get config(){return this.checkDestroyed(),this._config}get container(){return this._container}get isDeleted(){return this._isDeleted}set isDeleted(e){this._isDeleted=e}checkDestroyed(){if(this.isDeleted)throw _t.create("app-deleted",{appName:this._name})}}/**
 * @license
 * Copyright 2019 Google LLC
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
 */const yn=Ff;function $f(n,e={}){let t=n;typeof e!="object"&&(e={name:e});const r=Object.assign({name:Ms,automaticDataCollectionEnabled:!1},e),i=r.name;if(typeof i!="string"||!i)throw _t.create("bad-app-name",{appName:String(i)});if(t||(t=pu()),!t)throw _t.create("no-options");const o=rr.get(i);if(o){if(an(t,o.options)&&an(r,o.config))return o;throw _t.create("duplicate-app",{appName:i})}const a=new Kd(i);for(const l of Ls.values())a.addComponent(l);const u=new jf(t,r,a);return rr.set(i,u),u}function yu(n=Ms){const e=rr.get(n);if(!e&&n===Ms&&pu())return $f();if(!e)throw _t.create("no-app",{appName:n});return e}function Ov(){return Array.from(rr.values())}function yt(n,e,t){var r;let i=(r=Uf[n])!==null&&r!==void 0?r:n;t&&(i+=`-${t}`);const o=i.match(/\s|\//),a=e.match(/\s|\//);if(o||a){const u=[`Unable to register library "${i}" with version "${e}":`];o&&u.push(`library name "${i}" contains illegal characters (whitespace or "/")`),o&&a&&u.push("and"),a&&u.push(`version name "${e}" contains illegal characters (whitespace or "/")`),Ot.warn(u.join(" "));return}cn(new Nt(`${i}-version`,()=>({library:i,version:e}),"VERSION"))}/**
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
 */const zf="firebase-heartbeat-database",Wf=1,ir="firebase-heartbeat-store";let Ps=null;function vu(){return Ps||(Ps=cf(zf,Wf,{upgrade:(n,e)=>{switch(e){case 0:try{n.createObjectStore(ir)}catch(t){console.warn(t)}}}}).catch(n=>{throw _t.create("idb-open",{originalErrorMessage:n.message})})),Ps}async function Gf(n){try{const t=(await vu()).transaction(ir),r=await t.objectStore(ir).get(Eu(n));return await t.done,r}catch(e){if(e instanceof at)Ot.warn(e.message);else{const t=_t.create("idb-get",{originalErrorMessage:e?.message});Ot.warn(t.message)}}}async function sc(n,e){try{const r=(await vu()).transaction(ir,"readwrite");await r.objectStore(ir).put(e,Eu(n)),await r.done}catch(t){if(t instanceof at)Ot.warn(t.message);else{const r=_t.create("idb-set",{originalErrorMessage:t?.message});Ot.warn(r.message)}}}function Eu(n){return`${n.name}!${n.options.appId}`}/**
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
 */const Hf=1024,Kf=720*60*60*1e3;class Qf{constructor(e){this.container=e,this._heartbeatsCache=null;const t=this.container.getProvider("app").getImmediate();this._storage=new Xf(t),this._heartbeatsCachePromise=this._storage.read().then(r=>(this._heartbeatsCache=r,r))}async triggerHeartbeat(){var e,t;const i=this.container.getProvider("platform-logger").getImmediate().getPlatformInfoString(),o=oc();if(!(((e=this._heartbeatsCache)===null||e===void 0?void 0:e.heartbeats)==null&&(this._heartbeatsCache=await this._heartbeatsCachePromise,((t=this._heartbeatsCache)===null||t===void 0?void 0:t.heartbeats)==null))&&!(this._heartbeatsCache.lastSentHeartbeatDate===o||this._heartbeatsCache.heartbeats.some(a=>a.date===o)))return this._heartbeatsCache.heartbeats.push({date:o,agent:i}),this._heartbeatsCache.heartbeats=this._heartbeatsCache.heartbeats.filter(a=>{const u=new Date(a.date).valueOf();return Date.now()-u<=Kf}),this._storage.overwrite(this._heartbeatsCache)}async getHeartbeatsHeader(){var e;if(this._heartbeatsCache===null&&await this._heartbeatsCachePromise,((e=this._heartbeatsCache)===null||e===void 0?void 0:e.heartbeats)==null||this._heartbeatsCache.heartbeats.length===0)return"";const t=oc(),{heartbeatsToSend:r,unsentEntries:i}=Yf(this._heartbeatsCache.heartbeats),o=si(JSON.stringify({version:2,heartbeats:r}));return this._heartbeatsCache.lastSentHeartbeatDate=t,i.length>0?(this._heartbeatsCache.heartbeats=i,await this._storage.overwrite(this._heartbeatsCache)):(this._heartbeatsCache.heartbeats=[],this._storage.overwrite(this._heartbeatsCache)),o}}function oc(){return new Date().toISOString().substring(0,10)}function Yf(n,e=Hf){const t=[];let r=n.slice();for(const i of n){const o=t.find(a=>a.agent===i.agent);if(o){if(o.dates.push(i.date),ac(t)>e){o.dates.pop();break}}else if(t.push({agent:i.agent,dates:[i.date]}),ac(t)>e){t.pop();break}r=r.slice(1)}return{heartbeatsToSend:t,unsentEntries:r}}class Xf{constructor(e){this.app=e,this._canUseIndexedDBPromise=this.runIndexedDBEnvironmentCheck()}async runIndexedDBEnvironmentCheck(){return Vd()?Nd().then(()=>!0).catch(()=>!1):!1}async read(){if(await this._canUseIndexedDBPromise){const t=await Gf(this.app);return t?.heartbeats?t:{heartbeats:[]}}else return{heartbeats:[]}}async overwrite(e){var t;if(await this._canUseIndexedDBPromise){const i=await this.read();return sc(this.app,{lastSentHeartbeatDate:(t=e.lastSentHeartbeatDate)!==null&&t!==void 0?t:i.lastSentHeartbeatDate,heartbeats:e.heartbeats})}else return}async add(e){var t;if(await this._canUseIndexedDBPromise){const i=await this.read();return sc(this.app,{lastSentHeartbeatDate:(t=e.lastSentHeartbeatDate)!==null&&t!==void 0?t:i.lastSentHeartbeatDate,heartbeats:[...i.heartbeats,...e.heartbeats]})}else return}}function ac(n){return si(JSON.stringify({version:2,heartbeats:n})).length}/**
 * @license
 * Copyright 2019 Google LLC
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
 */function Jf(n){cn(new Nt("platform-logger",e=>new hf(e),"PRIVATE")),cn(new Nt("heartbeat",e=>new Qf(e),"PRIVATE")),yt(Os,rc,n),yt(Os,rc,"esm2017"),yt("fire-js","")}Jf("");var Zf="firebase",ep="10.12.4";/**
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
 */yt(Zf,ep,"app");function no(n,e){var t={};for(var r in n)Object.prototype.hasOwnProperty.call(n,r)&&e.indexOf(r)<0&&(t[r]=n[r]);if(n!=null&&typeof Object.getOwnPropertySymbols=="function")for(var i=0,r=Object.getOwnPropertySymbols(n);i<r.length;i++)e.indexOf(r[i])<0&&Object.prototype.propertyIsEnumerable.call(n,r[i])&&(t[r[i]]=n[r[i]]);return t}function Mv(n,e,t,r){var i=arguments.length,o=i<3?e:r===null?r=Object.getOwnPropertyDescriptor(e,t):r,a;if(typeof Reflect=="object"&&typeof Reflect.decorate=="function")o=Reflect.decorate(n,e,t,r);else for(var u=n.length-1;u>=0;u--)(a=n[u])&&(o=(i<3?a(o):i>3?a(e,t,o):a(e,t))||o);return i>3&&o&&Object.defineProperty(e,t,o),o}function Iu(){return{"dependent-sdk-initialized-before-auth":"Another Firebase SDK was initialized and is trying to use Auth before Auth is initialized. Please be sure to call `initializeAuth` or `getAuth` before starting any other Firebase SDK."}}const Tu=Iu,wu=new fr("auth","Firebase",Iu());/**
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
 */const oi=new eo("@firebase/auth");function tp(n,...e){oi.logLevel<=j.WARN&&oi.warn(`Auth (${yn}): ${n}`,...e)}function Xr(n,...e){oi.logLevel<=j.ERROR&&oi.error(`Auth (${yn}): ${n}`,...e)}/**
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
 */function Ne(n,...e){throw io(n,...e)}function Ve(n,...e){return io(n,...e)}function ro(n,e,t){const r=Object.assign(Object.assign({},Tu()),{[e]:t});return new fr("auth","Firebase",r).create(e,{appName:n.name})}function Ue(n){return ro(n,"operation-not-supported-in-this-environment","Operations that alter the current user are not supported in conjunction with FirebaseServerApp")}function Au(n,e,t){const r=t;if(!(e instanceof r))throw r.name!==e.constructor.name&&Ne(n,"argument-error"),ro(n,"argument-error",`Type of ${e.constructor.name} does not match expected instance.Did you pass a reference from a different Auth SDK?`)}function io(n,...e){if(typeof n!="string"){const t=e[0],r=[...e.slice(1)];return r[0]&&(r[0].appName=n.name),n._errorFactory.create(t,...r)}return wu.create(n,...e)}function L(n,e,...t){if(!n)throw io(e,...t)}function et(n){const e="INTERNAL ASSERTION FAILED: "+n;throw Xr(e),new Error(e)}function it(n,e){n||et(e)}/**
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
 */function xs(){var n;return typeof self<"u"&&((n=self.location)===null||n===void 0?void 0:n.href)||""}function np(){return cc()==="http:"||cc()==="https:"}function cc(){var n;return typeof self<"u"&&((n=self.location)===null||n===void 0?void 0:n.protocol)||null}/**
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
 */function rp(){return typeof navigator<"u"&&navigator&&"onLine"in navigator&&typeof navigator.onLine=="boolean"&&(np()||Cd()||"connection"in navigator)?navigator.onLine:!0}function ip(){if(typeof navigator>"u")return null;const n=navigator;return n.languages&&n.languages[0]||n.language||null}/**
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
 */class mr{constructor(e,t){this.shortDelay=e,this.longDelay=t,it(t>e,"Short delay should be less than long delay!"),this.isMobile=Pd()||bd()}get(){return rp()?this.isMobile?this.longDelay:this.shortDelay:Math.min(5e3,this.shortDelay)}}/**
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
 */function so(n,e){it(n.emulator,"Emulator should always be set here");const{url:t}=n.emulator;return e?`${t}${e.startsWith("/")?e.slice(1):e}`:t}/**
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
 */class Ru{static initialize(e,t,r){this.fetchImpl=e,t&&(this.headersImpl=t),r&&(this.responseImpl=r)}static fetch(){if(this.fetchImpl)return this.fetchImpl;if(typeof self<"u"&&"fetch"in self)return self.fetch;if(typeof globalThis<"u"&&globalThis.fetch)return globalThis.fetch;if(typeof fetch<"u")return fetch;et("Could not find fetch implementation, make sure you call FetchProvider.initialize() with an appropriate polyfill")}static headers(){if(this.headersImpl)return this.headersImpl;if(typeof self<"u"&&"Headers"in self)return self.Headers;if(typeof globalThis<"u"&&globalThis.Headers)return globalThis.Headers;if(typeof Headers<"u")return Headers;et("Could not find Headers implementation, make sure you call FetchProvider.initialize() with an appropriate polyfill")}static response(){if(this.responseImpl)return this.responseImpl;if(typeof self<"u"&&"Response"in self)return self.Response;if(typeof globalThis<"u"&&globalThis.Response)return globalThis.Response;if(typeof Response<"u")return Response;et("Could not find Response implementation, make sure you call FetchProvider.initialize() with an appropriate polyfill")}}/**
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
 */const sp={CREDENTIAL_MISMATCH:"custom-token-mismatch",MISSING_CUSTOM_TOKEN:"internal-error",INVALID_IDENTIFIER:"invalid-email",MISSING_CONTINUE_URI:"internal-error",INVALID_PASSWORD:"wrong-password",MISSING_PASSWORD:"missing-password",INVALID_LOGIN_CREDENTIALS:"invalid-credential",EMAIL_EXISTS:"email-already-in-use",PASSWORD_LOGIN_DISABLED:"operation-not-allowed",INVALID_IDP_RESPONSE:"invalid-credential",INVALID_PENDING_TOKEN:"invalid-credential",FEDERATED_USER_ID_ALREADY_LINKED:"credential-already-in-use",MISSING_REQ_TYPE:"internal-error",EMAIL_NOT_FOUND:"user-not-found",RESET_PASSWORD_EXCEED_LIMIT:"too-many-requests",EXPIRED_OOB_CODE:"expired-action-code",INVALID_OOB_CODE:"invalid-action-code",MISSING_OOB_CODE:"internal-error",CREDENTIAL_TOO_OLD_LOGIN_AGAIN:"requires-recent-login",INVALID_ID_TOKEN:"invalid-user-token",TOKEN_EXPIRED:"user-token-expired",USER_NOT_FOUND:"user-token-expired",TOO_MANY_ATTEMPTS_TRY_LATER:"too-many-requests",PASSWORD_DOES_NOT_MEET_REQUIREMENTS:"password-does-not-meet-requirements",INVALID_CODE:"invalid-verification-code",INVALID_SESSION_INFO:"invalid-verification-id",INVALID_TEMPORARY_PROOF:"invalid-credential",MISSING_SESSION_INFO:"missing-verification-id",SESSION_EXPIRED:"code-expired",MISSING_ANDROID_PACKAGE_NAME:"missing-android-pkg-name",UNAUTHORIZED_DOMAIN:"unauthorized-continue-uri",INVALID_OAUTH_CLIENT_ID:"invalid-oauth-client-id",ADMIN_ONLY_OPERATION:"admin-restricted-operation",INVALID_MFA_PENDING_CREDENTIAL:"invalid-multi-factor-session",MFA_ENROLLMENT_NOT_FOUND:"multi-factor-info-not-found",MISSING_MFA_ENROLLMENT_ID:"missing-multi-factor-info",MISSING_MFA_PENDING_CREDENTIAL:"missing-multi-factor-session",SECOND_FACTOR_EXISTS:"second-factor-already-in-use",SECOND_FACTOR_LIMIT_EXCEEDED:"maximum-second-factor-count-exceeded",BLOCKING_FUNCTION_ERROR_RESPONSE:"internal-error",RECAPTCHA_NOT_ENABLED:"recaptcha-not-enabled",MISSING_RECAPTCHA_TOKEN:"missing-recaptcha-token",INVALID_RECAPTCHA_TOKEN:"invalid-recaptcha-token",INVALID_RECAPTCHA_ACTION:"invalid-recaptcha-action",MISSING_CLIENT_TYPE:"missing-client-type",MISSING_RECAPTCHA_VERSION:"missing-recaptcha-version",INVALID_RECAPTCHA_VERSION:"invalid-recaptcha-version",INVALID_REQ_TYPE:"invalid-req-type"};/**
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
 */const op=new mr(3e4,6e4);function We(n,e){return n.tenantId&&!e.tenantId?Object.assign(Object.assign({},e),{tenantId:n.tenantId}):e}async function xe(n,e,t,r,i={}){return Pu(n,i,async()=>{let o={},a={};r&&(e==="GET"?a=r:o={body:JSON.stringify(r)});const u=pr(Object.assign({key:n.config.apiKey},a)).slice(1),l=await n._getAdditionalHeaders();return l["Content-Type"]="application/json",n.languageCode&&(l["X-Firebase-Locale"]=n.languageCode),Ru.fetch()(Su(n,n.config.apiHost,t,u),Object.assign({method:e,headers:l,referrerPolicy:"no-referrer"},o))})}async function Pu(n,e,t){n._canInitEmulator=!1;const r=Object.assign(Object.assign({},sp),e);try{const i=new cp(n),o=await Promise.race([t(),i.promise]);i.clearNetworkTimeout();const a=await o.json();if("needConfirmation"in a)throw Gr(n,"account-exists-with-different-credential",a);if(o.ok&&!("errorMessage"in a))return a;{const u=o.ok?a.errorMessage:a.error.message,[l,d]=u.split(" : ");if(l==="FEDERATED_USER_ID_ALREADY_LINKED")throw Gr(n,"credential-already-in-use",a);if(l==="EMAIL_EXISTS")throw Gr(n,"email-already-in-use",a);if(l==="USER_DISABLED")throw Gr(n,"user-disabled",a);const p=r[l]||l.toLowerCase().replace(/[_\s]+/g,"-");if(d)throw ro(n,p,d);Ne(n,p)}}catch(i){if(i instanceof at)throw i;Ne(n,"network-request-failed",{message:String(i)})}}async function vn(n,e,t,r,i={}){const o=await xe(n,e,t,r,i);return"mfaPendingCredential"in o&&Ne(n,"multi-factor-auth-required",{_serverResponse:o}),o}function Su(n,e,t,r){const i=`${e}${t}?${r}`;return n.config.emulator?so(n.config,i):`${n.config.apiScheme}://${i}`}function ap(n){switch(n){case"ENFORCE":return"ENFORCE";case"AUDIT":return"AUDIT";case"OFF":return"OFF";default:return"ENFORCEMENT_STATE_UNSPECIFIED"}}class cp{constructor(e){this.auth=e,this.timer=null,this.promise=new Promise((t,r)=>{this.timer=setTimeout(()=>r(Ve(this.auth,"network-request-failed")),op.get())})}clearNetworkTimeout(){clearTimeout(this.timer)}}function Gr(n,e,t){const r={appName:n.name};t.email&&(r.email=t.email),t.phoneNumber&&(r.phoneNumber=t.phoneNumber);const i=Ve(n,e,r);return i.customData._tokenResponse=t,i}function uc(n){return n!==void 0&&n.enterprise!==void 0}class up{constructor(e){if(this.siteKey="",this.recaptchaEnforcementState=[],e.recaptchaKey===void 0)throw new Error("recaptchaKey undefined");this.siteKey=e.recaptchaKey.split("/")[3],this.recaptchaEnforcementState=e.recaptchaEnforcementState}getProviderEnforcementState(e){if(!this.recaptchaEnforcementState||this.recaptchaEnforcementState.length===0)return null;for(const t of this.recaptchaEnforcementState)if(t.provider&&t.provider===e)return ap(t.enforcementState);return null}isProviderEnabled(e){return this.getProviderEnforcementState(e)==="ENFORCE"||this.getProviderEnforcementState(e)==="AUDIT"}}async function lp(n,e){return xe(n,"GET","/v2/recaptchaConfig",We(n,e))}/**
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
 */async function hp(n,e){return xe(n,"POST","/v1/accounts:delete",e)}async function Cu(n,e){return xe(n,"POST","/v1/accounts:lookup",e)}/**
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
 */function Yn(n){if(n)try{const e=new Date(Number(n));if(!isNaN(e.getTime()))return e.toUTCString()}catch{}}async function bu(n,e=!1){const t=Q(n),r=await t.getIdToken(e),i=oo(r);L(i&&i.exp&&i.auth_time&&i.iat,t.auth,"internal-error");const o=typeof i.firebase=="object"?i.firebase:void 0,a=o?.sign_in_provider;return{claims:i,token:r,authTime:Yn(Ss(i.auth_time)),issuedAtTime:Yn(Ss(i.iat)),expirationTime:Yn(Ss(i.exp)),signInProvider:a||null,signInSecondFactor:o?.sign_in_second_factor||null}}function Ss(n){return Number(n)*1e3}function oo(n){const[e,t,r]=n.split(".");if(e===void 0||t===void 0||r===void 0)return Xr("JWT malformed, contained fewer than 3 sections"),null;try{const i=du(t);return i?JSON.parse(i):(Xr("Failed to decode base64 JWT payload"),null)}catch(i){return Xr("Caught error parsing JWT payload as JSON",i?.toString()),null}}function lc(n){const e=oo(n);return L(e,"internal-error"),L(typeof e.exp<"u","internal-error"),L(typeof e.iat<"u","internal-error"),Number(e.exp)-Number(e.iat)}/**
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
 */async function Mt(n,e,t=!1){if(t)return e;try{return await e}catch(r){throw r instanceof at&&dp(r)&&n.auth.currentUser===n&&await n.auth.signOut(),r}}function dp({code:n}){return n==="auth/user-disabled"||n==="auth/user-token-expired"}/**
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
 */class fp{constructor(e){this.user=e,this.isRunning=!1,this.timerId=null,this.errorBackoff=3e4}_start(){this.isRunning||(this.isRunning=!0,this.schedule())}_stop(){this.isRunning&&(this.isRunning=!1,this.timerId!==null&&clearTimeout(this.timerId))}getInterval(e){var t;if(e){const r=this.errorBackoff;return this.errorBackoff=Math.min(this.errorBackoff*2,96e4),r}else{this.errorBackoff=3e4;const i=((t=this.user.stsTokenManager.expirationTime)!==null&&t!==void 0?t:0)-Date.now()-3e5;return Math.max(0,i)}}schedule(e=!1){if(!this.isRunning)return;const t=this.getInterval(e);this.timerId=setTimeout(async()=>{await this.iteration()},t)}async iteration(){try{await this.user.getIdToken(!0)}catch(e){e?.code==="auth/network-request-failed"&&this.schedule(!0);return}this.schedule()}}/**
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
 */class Fs{constructor(e,t){this.createdAt=e,this.lastLoginAt=t,this._initializeTime()}_initializeTime(){this.lastSignInTime=Yn(this.lastLoginAt),this.creationTime=Yn(this.createdAt)}_copy(e){this.createdAt=e.createdAt,this.lastLoginAt=e.lastLoginAt,this._initializeTime()}toJSON(){return{createdAt:this.createdAt,lastLoginAt:this.lastLoginAt}}}/**
 * @license
 * Copyright 2019 Google LLC
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
 */async function ai(n){var e;const t=n.auth,r=await n.getIdToken(),i=await Mt(n,Cu(t,{idToken:r}));L(i?.users.length,t,"internal-error");const o=i.users[0];n._notifyReloadListener(o);const a=!((e=o.providerUserInfo)===null||e===void 0)&&e.length?Du(o.providerUserInfo):[],u=pp(n.providerData,a),l=n.isAnonymous,d=!(n.email&&o.passwordHash)&&!u?.length,p=l?d:!1,y={uid:o.localId,displayName:o.displayName||null,photoURL:o.photoUrl||null,email:o.email||null,emailVerified:o.emailVerified||!1,phoneNumber:o.phoneNumber||null,tenantId:o.tenantId||null,providerData:u,metadata:new Fs(o.createdAt,o.lastLoginAt),isAnonymous:p};Object.assign(n,y)}async function ku(n){const e=Q(n);await ai(e),await e.auth._persistUserIfCurrent(e),e.auth._notifyListenersIfCurrent(e)}function pp(n,e){return[...n.filter(r=>!e.some(i=>i.providerId===r.providerId)),...e]}function Du(n){return n.map(e=>{var{providerId:t}=e,r=no(e,["providerId"]);return{providerId:t,uid:r.rawId||"",displayName:r.displayName||null,email:r.email||null,phoneNumber:r.phoneNumber||null,photoURL:r.photoUrl||null}})}/**
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
 */async function mp(n,e){const t=await Pu(n,{},async()=>{const r=pr({grant_type:"refresh_token",refresh_token:e}).slice(1),{tokenApiHost:i,apiKey:o}=n.config,a=Su(n,i,"/v1/token",`key=${o}`),u=await n._getAdditionalHeaders();return u["Content-Type"]="application/x-www-form-urlencoded",Ru.fetch()(a,{method:"POST",headers:u,body:r})});return{accessToken:t.access_token,expiresIn:t.expires_in,refreshToken:t.refresh_token}}async function gp(n,e){return xe(n,"POST","/v2/accounts:revokeToken",We(n,e))}/**
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
 */class tn{constructor(){this.refreshToken=null,this.accessToken=null,this.expirationTime=null}get isExpired(){return!this.expirationTime||Date.now()>this.expirationTime-3e4}updateFromServerResponse(e){L(e.idToken,"internal-error"),L(typeof e.idToken<"u","internal-error"),L(typeof e.refreshToken<"u","internal-error");const t="expiresIn"in e&&typeof e.expiresIn<"u"?Number(e.expiresIn):lc(e.idToken);this.updateTokensAndExpiration(e.idToken,e.refreshToken,t)}updateFromIdToken(e){L(e.length!==0,"internal-error");const t=lc(e);this.updateTokensAndExpiration(e,null,t)}async getToken(e,t=!1){return!t&&this.accessToken&&!this.isExpired?this.accessToken:(L(this.refreshToken,e,"user-token-expired"),this.refreshToken?(await this.refresh(e,this.refreshToken),this.accessToken):null)}clearRefreshToken(){this.refreshToken=null}async refresh(e,t){const{accessToken:r,refreshToken:i,expiresIn:o}=await mp(e,t);this.updateTokensAndExpiration(r,i,Number(o))}updateTokensAndExpiration(e,t,r){this.refreshToken=t||null,this.accessToken=e||null,this.expirationTime=Date.now()+r*1e3}static fromJSON(e,t){const{refreshToken:r,accessToken:i,expirationTime:o}=t,a=new tn;return r&&(L(typeof r=="string","internal-error",{appName:e}),a.refreshToken=r),i&&(L(typeof i=="string","internal-error",{appName:e}),a.accessToken=i),o&&(L(typeof o=="number","internal-error",{appName:e}),a.expirationTime=o),a}toJSON(){return{refreshToken:this.refreshToken,accessToken:this.accessToken,expirationTime:this.expirationTime}}_assign(e){this.accessToken=e.accessToken,this.refreshToken=e.refreshToken,this.expirationTime=e.expirationTime}_clone(){return Object.assign(new tn,this.toJSON())}_performRefresh(){return et("not implemented")}}/**
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
 */function dt(n,e){L(typeof n=="string"||typeof n>"u","internal-error",{appName:e})}class tt{constructor(e){var{uid:t,auth:r,stsTokenManager:i}=e,o=no(e,["uid","auth","stsTokenManager"]);this.providerId="firebase",this.proactiveRefresh=new fp(this),this.reloadUserInfo=null,this.reloadListener=null,this.uid=t,this.auth=r,this.stsTokenManager=i,this.accessToken=i.accessToken,this.displayName=o.displayName||null,this.email=o.email||null,this.emailVerified=o.emailVerified||!1,this.phoneNumber=o.phoneNumber||null,this.photoURL=o.photoURL||null,this.isAnonymous=o.isAnonymous||!1,this.tenantId=o.tenantId||null,this.providerData=o.providerData?[...o.providerData]:[],this.metadata=new Fs(o.createdAt||void 0,o.lastLoginAt||void 0)}async getIdToken(e){const t=await Mt(this,this.stsTokenManager.getToken(this.auth,e));return L(t,this.auth,"internal-error"),this.accessToken!==t&&(this.accessToken=t,await this.auth._persistUserIfCurrent(this),this.auth._notifyListenersIfCurrent(this)),t}getIdTokenResult(e){return bu(this,e)}reload(){return ku(this)}_assign(e){this!==e&&(L(this.uid===e.uid,this.auth,"internal-error"),this.displayName=e.displayName,this.photoURL=e.photoURL,this.email=e.email,this.emailVerified=e.emailVerified,this.phoneNumber=e.phoneNumber,this.isAnonymous=e.isAnonymous,this.tenantId=e.tenantId,this.providerData=e.providerData.map(t=>Object.assign({},t)),this.metadata._copy(e.metadata),this.stsTokenManager._assign(e.stsTokenManager))}_clone(e){const t=new tt(Object.assign(Object.assign({},this),{auth:e,stsTokenManager:this.stsTokenManager._clone()}));return t.metadata._copy(this.metadata),t}_onReload(e){L(!this.reloadListener,this.auth,"internal-error"),this.reloadListener=e,this.reloadUserInfo&&(this._notifyReloadListener(this.reloadUserInfo),this.reloadUserInfo=null)}_notifyReloadListener(e){this.reloadListener?this.reloadListener(e):this.reloadUserInfo=e}_startProactiveRefresh(){this.proactiveRefresh._start()}_stopProactiveRefresh(){this.proactiveRefresh._stop()}async _updateTokensIfNecessary(e,t=!1){let r=!1;e.idToken&&e.idToken!==this.stsTokenManager.accessToken&&(this.stsTokenManager.updateFromServerResponse(e),r=!0),t&&await ai(this),await this.auth._persistUserIfCurrent(this),r&&this.auth._notifyListenersIfCurrent(this)}async delete(){if(Ce(this.auth.app))return Promise.reject(Ue(this.auth));const e=await this.getIdToken();return await Mt(this,hp(this.auth,{idToken:e})),this.stsTokenManager.clearRefreshToken(),this.auth.signOut()}toJSON(){return Object.assign(Object.assign({uid:this.uid,email:this.email||void 0,emailVerified:this.emailVerified,displayName:this.displayName||void 0,isAnonymous:this.isAnonymous,photoURL:this.photoURL||void 0,phoneNumber:this.phoneNumber||void 0,tenantId:this.tenantId||void 0,providerData:this.providerData.map(e=>Object.assign({},e)),stsTokenManager:this.stsTokenManager.toJSON(),_redirectEventId:this._redirectEventId},this.metadata.toJSON()),{apiKey:this.auth.config.apiKey,appName:this.auth.name})}get refreshToken(){return this.stsTokenManager.refreshToken||""}static _fromJSON(e,t){var r,i,o,a,u,l,d,p;const y=(r=t.displayName)!==null&&r!==void 0?r:void 0,T=(i=t.email)!==null&&i!==void 0?i:void 0,S=(o=t.phoneNumber)!==null&&o!==void 0?o:void 0,V=(a=t.photoURL)!==null&&a!==void 0?a:void 0,N=(u=t.tenantId)!==null&&u!==void 0?u:void 0,k=(l=t._redirectEventId)!==null&&l!==void 0?l:void 0,B=(d=t.createdAt)!==null&&d!==void 0?d:void 0,W=(p=t.lastLoginAt)!==null&&p!==void 0?p:void 0,{uid:H,emailVerified:te,isAnonymous:De,providerData:ne,stsTokenManager:E}=t;L(H&&E,e,"internal-error");const m=tn.fromJSON(this.name,E);L(typeof H=="string",e,"internal-error"),dt(y,e.name),dt(T,e.name),L(typeof te=="boolean",e,"internal-error"),L(typeof De=="boolean",e,"internal-error"),dt(S,e.name),dt(V,e.name),dt(N,e.name),dt(k,e.name),dt(B,e.name),dt(W,e.name);const _=new tt({uid:H,auth:e,email:T,emailVerified:te,displayName:y,isAnonymous:De,photoURL:V,phoneNumber:S,tenantId:N,stsTokenManager:m,createdAt:B,lastLoginAt:W});return ne&&Array.isArray(ne)&&(_.providerData=ne.map(v=>Object.assign({},v))),k&&(_._redirectEventId=k),_}static async _fromIdTokenResponse(e,t,r=!1){const i=new tn;i.updateFromServerResponse(t);const o=new tt({uid:t.localId,auth:e,stsTokenManager:i,isAnonymous:r});return await ai(o),o}static async _fromGetAccountInfoResponse(e,t,r){const i=t.users[0];L(i.localId!==void 0,"internal-error");const o=i.providerUserInfo!==void 0?Du(i.providerUserInfo):[],a=!(i.email&&i.passwordHash)&&!o?.length,u=new tn;u.updateFromIdToken(r);const l=new tt({uid:i.localId,auth:e,stsTokenManager:u,isAnonymous:a}),d={uid:i.localId,displayName:i.displayName||null,photoURL:i.photoUrl||null,email:i.email||null,emailVerified:i.emailVerified||!1,phoneNumber:i.phoneNumber||null,tenantId:i.tenantId||null,providerData:o,metadata:new Fs(i.createdAt,i.lastLoginAt),isAnonymous:!(i.email&&i.passwordHash)&&!o?.length};return Object.assign(l,d),l}}/**
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
 */const hc=new Map;function nt(n){it(n instanceof Function,"Expected a class definition");let e=hc.get(n);return e?(it(e instanceof n,"Instance stored in cache mismatched with class"),e):(e=new n,hc.set(n,e),e)}/**
 * @license
 * Copyright 2019 Google LLC
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
 */class Vu{constructor(){this.type="NONE",this.storage={}}async _isAvailable(){return!0}async _set(e,t){this.storage[e]=t}async _get(e){const t=this.storage[e];return t===void 0?null:t}async _remove(e){delete this.storage[e]}_addListener(e,t){}_removeListener(e,t){}}Vu.type="NONE";const Us=Vu;/**
 * @license
 * Copyright 2019 Google LLC
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
 */function Jr(n,e,t){return`firebase:${n}:${e}:${t}`}class nn{constructor(e,t,r){this.persistence=e,this.auth=t,this.userKey=r;const{config:i,name:o}=this.auth;this.fullUserKey=Jr(this.userKey,i.apiKey,o),this.fullPersistenceKey=Jr("persistence",i.apiKey,o),this.boundEventHandler=t._onStorageEvent.bind(t),this.persistence._addListener(this.fullUserKey,this.boundEventHandler)}setCurrentUser(e){return this.persistence._set(this.fullUserKey,e.toJSON())}async getCurrentUser(){const e=await this.persistence._get(this.fullUserKey);return e?tt._fromJSON(this.auth,e):null}removeCurrentUser(){return this.persistence._remove(this.fullUserKey)}savePersistenceForRedirect(){return this.persistence._set(this.fullPersistenceKey,this.persistence.type)}async setPersistence(e){if(this.persistence===e)return;const t=await this.getCurrentUser();if(await this.removeCurrentUser(),this.persistence=e,t)return this.setCurrentUser(t)}delete(){this.persistence._removeListener(this.fullUserKey,this.boundEventHandler)}static async create(e,t,r="authUser"){if(!t.length)return new nn(nt(Us),e,r);const i=(await Promise.all(t.map(async d=>{if(await d._isAvailable())return d}))).filter(d=>d);let o=i[0]||nt(Us);const a=Jr(r,e.config.apiKey,e.name);let u=null;for(const d of t)try{const p=await d._get(a);if(p){const y=tt._fromJSON(e,p);d!==o&&(u=y),o=d;break}}catch{}const l=i.filter(d=>d._shouldAllowMigration);return!o._shouldAllowMigration||!l.length?new nn(o,e,r):(o=l[0],u&&await o._set(a,u.toJSON()),await Promise.all(t.map(async d=>{if(d!==o)try{await d._remove(a)}catch{}})),new nn(o,e,r))}}/**
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
 */function dc(n){const e=n.toLowerCase();if(e.includes("opera/")||e.includes("opr/")||e.includes("opios/"))return"Opera";if(Mu(e))return"IEMobile";if(e.includes("msie")||e.includes("trident/"))return"IE";if(e.includes("edge/"))return"Edge";if(Nu(e))return"Firefox";if(e.includes("silk/"))return"Silk";if(xu(e))return"Blackberry";if(Fu(e))return"Webos";if(ao(e))return"Safari";if((e.includes("chrome/")||Ou(e))&&!e.includes("edge/"))return"Chrome";if(Lu(e))return"Android";{const t=/([a-zA-Z\d\.]+)\/[a-zA-Z\d\.]*$/,r=n.match(t);if(r?.length===2)return r[1]}return"Other"}function Nu(n=ge()){return/firefox\//i.test(n)}function ao(n=ge()){const e=n.toLowerCase();return e.includes("safari/")&&!e.includes("chrome/")&&!e.includes("crios/")&&!e.includes("android")}function Ou(n=ge()){return/crios\//i.test(n)}function Mu(n=ge()){return/iemobile/i.test(n)}function Lu(n=ge()){return/android/i.test(n)}function xu(n=ge()){return/blackberry/i.test(n)}function Fu(n=ge()){return/webos/i.test(n)}function Ti(n=ge()){return/iphone|ipad|ipod/i.test(n)||/macintosh/i.test(n)&&/mobile/i.test(n)}function _p(n=ge()){var e;return Ti(n)&&!!(!((e=window.navigator)===null||e===void 0)&&e.standalone)}function yp(){return kd()&&document.documentMode===10}function Uu(n=ge()){return Ti(n)||Lu(n)||Fu(n)||xu(n)||/windows phone/i.test(n)||Mu(n)}function vp(){try{return!!(window&&window!==window.top)}catch{return!1}}/**
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
 */function Bu(n,e=[]){let t;switch(n){case"Browser":t=dc(ge());break;case"Worker":t=`${dc(ge())}-${n}`;break;default:t=n}const r=e.length?e.join(","):"FirebaseCore-web";return`${t}/JsCore/${yn}/${r}`}/**
 * @license
 * Copyright 2022 Google LLC
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
 */class Ep{constructor(e){this.auth=e,this.queue=[]}pushCallback(e,t){const r=o=>new Promise((a,u)=>{try{const l=e(o);a(l)}catch(l){u(l)}});r.onAbort=t,this.queue.push(r);const i=this.queue.length-1;return()=>{this.queue[i]=()=>Promise.resolve()}}async runMiddleware(e){if(this.auth.currentUser===e)return;const t=[];try{for(const r of this.queue)await r(e),r.onAbort&&t.push(r.onAbort)}catch(r){t.reverse();for(const i of t)try{i()}catch{}throw this.auth._errorFactory.create("login-blocked",{originalMessage:r?.message})}}}/**
 * @license
 * Copyright 2023 Google LLC
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
 */async function Ip(n,e={}){return xe(n,"GET","/v2/passwordPolicy",We(n,e))}/**
 * @license
 * Copyright 2023 Google LLC
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
 */const Tp=6;class wp{constructor(e){var t,r,i,o;const a=e.customStrengthOptions;this.customStrengthOptions={},this.customStrengthOptions.minPasswordLength=(t=a.minPasswordLength)!==null&&t!==void 0?t:Tp,a.maxPasswordLength&&(this.customStrengthOptions.maxPasswordLength=a.maxPasswordLength),a.containsLowercaseCharacter!==void 0&&(this.customStrengthOptions.containsLowercaseLetter=a.containsLowercaseCharacter),a.containsUppercaseCharacter!==void 0&&(this.customStrengthOptions.containsUppercaseLetter=a.containsUppercaseCharacter),a.containsNumericCharacter!==void 0&&(this.customStrengthOptions.containsNumericCharacter=a.containsNumericCharacter),a.containsNonAlphanumericCharacter!==void 0&&(this.customStrengthOptions.containsNonAlphanumericCharacter=a.containsNonAlphanumericCharacter),this.enforcementState=e.enforcementState,this.enforcementState==="ENFORCEMENT_STATE_UNSPECIFIED"&&(this.enforcementState="OFF"),this.allowedNonAlphanumericCharacters=(i=(r=e.allowedNonAlphanumericCharacters)===null||r===void 0?void 0:r.join(""))!==null&&i!==void 0?i:"",this.forceUpgradeOnSignin=(o=e.forceUpgradeOnSignin)!==null&&o!==void 0?o:!1,this.schemaVersion=e.schemaVersion}validatePassword(e){var t,r,i,o,a,u;const l={isValid:!0,passwordPolicy:this};return this.validatePasswordLengthOptions(e,l),this.validatePasswordCharacterOptions(e,l),l.isValid&&(l.isValid=(t=l.meetsMinPasswordLength)!==null&&t!==void 0?t:!0),l.isValid&&(l.isValid=(r=l.meetsMaxPasswordLength)!==null&&r!==void 0?r:!0),l.isValid&&(l.isValid=(i=l.containsLowercaseLetter)!==null&&i!==void 0?i:!0),l.isValid&&(l.isValid=(o=l.containsUppercaseLetter)!==null&&o!==void 0?o:!0),l.isValid&&(l.isValid=(a=l.containsNumericCharacter)!==null&&a!==void 0?a:!0),l.isValid&&(l.isValid=(u=l.containsNonAlphanumericCharacter)!==null&&u!==void 0?u:!0),l}validatePasswordLengthOptions(e,t){const r=this.customStrengthOptions.minPasswordLength,i=this.customStrengthOptions.maxPasswordLength;r&&(t.meetsMinPasswordLength=e.length>=r),i&&(t.meetsMaxPasswordLength=e.length<=i)}validatePasswordCharacterOptions(e,t){this.updatePasswordCharacterOptionsStatuses(t,!1,!1,!1,!1);let r;for(let i=0;i<e.length;i++)r=e.charAt(i),this.updatePasswordCharacterOptionsStatuses(t,r>="a"&&r<="z",r>="A"&&r<="Z",r>="0"&&r<="9",this.allowedNonAlphanumericCharacters.includes(r))}updatePasswordCharacterOptionsStatuses(e,t,r,i,o){this.customStrengthOptions.containsLowercaseLetter&&(e.containsLowercaseLetter||(e.containsLowercaseLetter=t)),this.customStrengthOptions.containsUppercaseLetter&&(e.containsUppercaseLetter||(e.containsUppercaseLetter=r)),this.customStrengthOptions.containsNumericCharacter&&(e.containsNumericCharacter||(e.containsNumericCharacter=i)),this.customStrengthOptions.containsNonAlphanumericCharacter&&(e.containsNonAlphanumericCharacter||(e.containsNonAlphanumericCharacter=o))}}/**
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
 */class Ap{constructor(e,t,r,i){this.app=e,this.heartbeatServiceProvider=t,this.appCheckServiceProvider=r,this.config=i,this.currentUser=null,this.emulatorConfig=null,this.operations=Promise.resolve(),this.authStateSubscription=new fc(this),this.idTokenSubscription=new fc(this),this.beforeStateQueue=new Ep(this),this.redirectUser=null,this.isProactiveRefreshEnabled=!1,this.EXPECTED_PASSWORD_POLICY_SCHEMA_VERSION=1,this._canInitEmulator=!0,this._isInitialized=!1,this._deleted=!1,this._initializationPromise=null,this._popupRedirectResolver=null,this._errorFactory=wu,this._agentRecaptchaConfig=null,this._tenantRecaptchaConfigs={},this._projectPasswordPolicy=null,this._tenantPasswordPolicies={},this.lastNotifiedUid=void 0,this.languageCode=null,this.tenantId=null,this.settings={appVerificationDisabledForTesting:!1},this.frameworks=[],this.name=e.name,this.clientVersion=i.sdkClientVersion}_initializeWithPersistence(e,t){return t&&(this._popupRedirectResolver=nt(t)),this._initializationPromise=this.queue(async()=>{var r,i;if(!this._deleted&&(this.persistenceManager=await nn.create(this,e),!this._deleted)){if(!((r=this._popupRedirectResolver)===null||r===void 0)&&r._shouldInitProactively)try{await this._popupRedirectResolver._initialize(this)}catch{}await this.initializeCurrentUser(t),this.lastNotifiedUid=((i=this.currentUser)===null||i===void 0?void 0:i.uid)||null,!this._deleted&&(this._isInitialized=!0)}}),this._initializationPromise}async _onStorageEvent(){if(this._deleted)return;const e=await this.assertedPersistence.getCurrentUser();if(!(!this.currentUser&&!e)){if(this.currentUser&&e&&this.currentUser.uid===e.uid){this._currentUser._assign(e),await this.currentUser.getIdToken();return}await this._updateCurrentUser(e,!0)}}async initializeCurrentUserFromIdToken(e){try{const t=await Cu(this,{idToken:e}),r=await tt._fromGetAccountInfoResponse(this,t,e);await this.directlySetCurrentUser(r)}catch(t){console.warn("FirebaseServerApp could not login user with provided authIdToken: ",t),await this.directlySetCurrentUser(null)}}async initializeCurrentUser(e){var t;if(Ce(this.app)){const a=this.app.settings.authIdToken;return a?new Promise(u=>{setTimeout(()=>this.initializeCurrentUserFromIdToken(a).then(u,u))}):this.directlySetCurrentUser(null)}const r=await this.assertedPersistence.getCurrentUser();let i=r,o=!1;if(e&&this.config.authDomain){await this.getOrInitRedirectPersistenceManager();const a=(t=this.redirectUser)===null||t===void 0?void 0:t._redirectEventId,u=i?._redirectEventId,l=await this.tryRedirectSignIn(e);(!a||a===u)&&l?.user&&(i=l.user,o=!0)}if(!i)return this.directlySetCurrentUser(null);if(!i._redirectEventId){if(o)try{await this.beforeStateQueue.runMiddleware(i)}catch(a){i=r,this._popupRedirectResolver._overrideRedirectResult(this,()=>Promise.reject(a))}return i?this.reloadAndSetCurrentUserOrClear(i):this.directlySetCurrentUser(null)}return L(this._popupRedirectResolver,this,"argument-error"),await this.getOrInitRedirectPersistenceManager(),this.redirectUser&&this.redirectUser._redirectEventId===i._redirectEventId?this.directlySetCurrentUser(i):this.reloadAndSetCurrentUserOrClear(i)}async tryRedirectSignIn(e){let t=null;try{t=await this._popupRedirectResolver._completeRedirectFn(this,e,!0)}catch{await this._setRedirectUser(null)}return t}async reloadAndSetCurrentUserOrClear(e){try{await ai(e)}catch(t){if(t?.code!=="auth/network-request-failed")return this.directlySetCurrentUser(null)}return this.directlySetCurrentUser(e)}useDeviceLanguage(){this.languageCode=ip()}async _delete(){this._deleted=!0}async updateCurrentUser(e){if(Ce(this.app))return Promise.reject(Ue(this));const t=e?Q(e):null;return t&&L(t.auth.config.apiKey===this.config.apiKey,this,"invalid-user-token"),this._updateCurrentUser(t&&t._clone(this))}async _updateCurrentUser(e,t=!1){if(!this._deleted)return e&&L(this.tenantId===e.tenantId,this,"tenant-id-mismatch"),t||await this.beforeStateQueue.runMiddleware(e),this.queue(async()=>{await this.directlySetCurrentUser(e),this.notifyAuthListeners()})}async signOut(){return Ce(this.app)?Promise.reject(Ue(this)):(await this.beforeStateQueue.runMiddleware(null),(this.redirectPersistenceManager||this._popupRedirectResolver)&&await this._setRedirectUser(null),this._updateCurrentUser(null,!0))}setPersistence(e){return Ce(this.app)?Promise.reject(Ue(this)):this.queue(async()=>{await this.assertedPersistence.setPersistence(nt(e))})}_getRecaptchaConfig(){return this.tenantId==null?this._agentRecaptchaConfig:this._tenantRecaptchaConfigs[this.tenantId]}async validatePassword(e){this._getPasswordPolicyInternal()||await this._updatePasswordPolicy();const t=this._getPasswordPolicyInternal();return t.schemaVersion!==this.EXPECTED_PASSWORD_POLICY_SCHEMA_VERSION?Promise.reject(this._errorFactory.create("unsupported-password-policy-schema-version",{})):t.validatePassword(e)}_getPasswordPolicyInternal(){return this.tenantId===null?this._projectPasswordPolicy:this._tenantPasswordPolicies[this.tenantId]}async _updatePasswordPolicy(){const e=await Ip(this),t=new wp(e);this.tenantId===null?this._projectPasswordPolicy=t:this._tenantPasswordPolicies[this.tenantId]=t}_getPersistence(){return this.assertedPersistence.persistence.type}_updateErrorMap(e){this._errorFactory=new fr("auth","Firebase",e())}onAuthStateChanged(e,t,r){return this.registerStateListener(this.authStateSubscription,e,t,r)}beforeAuthStateChanged(e,t){return this.beforeStateQueue.pushCallback(e,t)}onIdTokenChanged(e,t,r){return this.registerStateListener(this.idTokenSubscription,e,t,r)}authStateReady(){return new Promise((e,t)=>{if(this.currentUser)e();else{const r=this.onAuthStateChanged(()=>{r(),e()},t)}})}async revokeAccessToken(e){if(this.currentUser){const t=await this.currentUser.getIdToken(),r={providerId:"apple.com",tokenType:"ACCESS_TOKEN",token:e,idToken:t};this.tenantId!=null&&(r.tenantId=this.tenantId),await gp(this,r)}}toJSON(){var e;return{apiKey:this.config.apiKey,authDomain:this.config.authDomain,appName:this.name,currentUser:(e=this._currentUser)===null||e===void 0?void 0:e.toJSON()}}async _setRedirectUser(e,t){const r=await this.getOrInitRedirectPersistenceManager(t);return e===null?r.removeCurrentUser():r.setCurrentUser(e)}async getOrInitRedirectPersistenceManager(e){if(!this.redirectPersistenceManager){const t=e&&nt(e)||this._popupRedirectResolver;L(t,this,"argument-error"),this.redirectPersistenceManager=await nn.create(this,[nt(t._redirectPersistence)],"redirectUser"),this.redirectUser=await this.redirectPersistenceManager.getCurrentUser()}return this.redirectPersistenceManager}async _redirectUserForId(e){var t,r;return this._isInitialized&&await this.queue(async()=>{}),((t=this._currentUser)===null||t===void 0?void 0:t._redirectEventId)===e?this._currentUser:((r=this.redirectUser)===null||r===void 0?void 0:r._redirectEventId)===e?this.redirectUser:null}async _persistUserIfCurrent(e){if(e===this.currentUser)return this.queue(async()=>this.directlySetCurrentUser(e))}_notifyListenersIfCurrent(e){e===this.currentUser&&this.notifyAuthListeners()}_key(){return`${this.config.authDomain}:${this.config.apiKey}:${this.name}`}_startProactiveRefresh(){this.isProactiveRefreshEnabled=!0,this.currentUser&&this._currentUser._startProactiveRefresh()}_stopProactiveRefresh(){this.isProactiveRefreshEnabled=!1,this.currentUser&&this._currentUser._stopProactiveRefresh()}get _currentUser(){return this.currentUser}notifyAuthListeners(){var e,t;if(!this._isInitialized)return;this.idTokenSubscription.next(this.currentUser);const r=(t=(e=this.currentUser)===null||e===void 0?void 0:e.uid)!==null&&t!==void 0?t:null;this.lastNotifiedUid!==r&&(this.lastNotifiedUid=r,this.authStateSubscription.next(this.currentUser))}registerStateListener(e,t,r,i){if(this._deleted)return()=>{};const o=typeof t=="function"?t:t.next.bind(t);let a=!1;const u=this._isInitialized?Promise.resolve():this._initializationPromise;if(L(u,this,"internal-error"),u.then(()=>{a||o(this.currentUser)}),typeof t=="function"){const l=e.addObserver(t,r,i);return()=>{a=!0,l()}}else{const l=e.addObserver(t);return()=>{a=!0,l()}}}async directlySetCurrentUser(e){this.currentUser&&this.currentUser!==e&&this._currentUser._stopProactiveRefresh(),e&&this.isProactiveRefreshEnabled&&e._startProactiveRefresh(),this.currentUser=e,e?await this.assertedPersistence.setCurrentUser(e):await this.assertedPersistence.removeCurrentUser()}queue(e){return this.operations=this.operations.then(e,e),this.operations}get assertedPersistence(){return L(this.persistenceManager,this,"internal-error"),this.persistenceManager}_logFramework(e){!e||this.frameworks.includes(e)||(this.frameworks.push(e),this.frameworks.sort(),this.clientVersion=Bu(this.config.clientPlatform,this._getFrameworks()))}_getFrameworks(){return this.frameworks}async _getAdditionalHeaders(){var e;const t={"X-Client-Version":this.clientVersion};this.app.options.appId&&(t["X-Firebase-gmpid"]=this.app.options.appId);const r=await((e=this.heartbeatServiceProvider.getImmediate({optional:!0}))===null||e===void 0?void 0:e.getHeartbeatsHeader());r&&(t["X-Firebase-Client"]=r);const i=await this._getAppCheckToken();return i&&(t["X-Firebase-AppCheck"]=i),t}async _getAppCheckToken(){var e;const t=await((e=this.appCheckServiceProvider.getImmediate({optional:!0}))===null||e===void 0?void 0:e.getToken());return t?.error&&tp(`Error while retrieving App Check token: ${t.error}`),t?.token}}function Ge(n){return Q(n)}class fc{constructor(e){this.auth=e,this.observer=null,this.addObserver=Fd(t=>this.observer=t)}get next(){return L(this.observer,this.auth,"internal-error"),this.observer.next.bind(this.observer)}}/**
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
 */let wi={async loadJS(){throw new Error("Unable to load external scripts")},recaptchaV2Script:"",recaptchaEnterpriseScript:"",gapiScript:""};function Rp(n){wi=n}function qu(n){return wi.loadJS(n)}function Pp(){return wi.recaptchaEnterpriseScript}function Sp(){return wi.gapiScript}function Cp(n){return`__${n}${Math.floor(Math.random()*1e6)}`}const bp="recaptcha-enterprise",kp="NO_RECAPTCHA";class Dp{constructor(e){this.type=bp,this.auth=Ge(e)}async verify(e="verify",t=!1){async function r(o){if(!t){if(o.tenantId==null&&o._agentRecaptchaConfig!=null)return o._agentRecaptchaConfig.siteKey;if(o.tenantId!=null&&o._tenantRecaptchaConfigs[o.tenantId]!==void 0)return o._tenantRecaptchaConfigs[o.tenantId].siteKey}return new Promise(async(a,u)=>{lp(o,{clientType:"CLIENT_TYPE_WEB",version:"RECAPTCHA_ENTERPRISE"}).then(l=>{if(l.recaptchaKey===void 0)u(new Error("recaptcha Enterprise site key undefined"));else{const d=new up(l);return o.tenantId==null?o._agentRecaptchaConfig=d:o._tenantRecaptchaConfigs[o.tenantId]=d,a(d.siteKey)}}).catch(l=>{u(l)})})}function i(o,a,u){const l=window.grecaptcha;uc(l)?l.enterprise.ready(()=>{l.enterprise.execute(o,{action:e}).then(d=>{a(d)}).catch(()=>{a(kp)})}):u(Error("No reCAPTCHA enterprise script loaded."))}return new Promise((o,a)=>{r(this.auth).then(u=>{if(!t&&uc(window.grecaptcha))i(u,o,a);else{if(typeof window>"u"){a(new Error("RecaptchaVerifier is only supported in browser"));return}let l=Pp();l.length!==0&&(l+=u),qu(l).then(()=>{i(u,o,a)}).catch(d=>{a(d)})}}).catch(u=>{a(u)})})}}async function pc(n,e,t,r=!1){const i=new Dp(n);let o;try{o=await i.verify(t)}catch{o=await i.verify(t,!0)}const a=Object.assign({},e);return r?Object.assign(a,{captchaResp:o}):Object.assign(a,{captchaResponse:o}),Object.assign(a,{clientType:"CLIENT_TYPE_WEB"}),Object.assign(a,{recaptchaVersion:"RECAPTCHA_ENTERPRISE"}),a}async function ci(n,e,t,r){var i;if(!((i=n._getRecaptchaConfig())===null||i===void 0)&&i.isProviderEnabled("EMAIL_PASSWORD_PROVIDER")){const o=await pc(n,e,t,t==="getOobCode");return r(n,o)}else return r(n,e).catch(async o=>{if(o.code==="auth/missing-recaptcha-token"){console.log(`${t} is protected by reCAPTCHA Enterprise for this project. Automatically triggering the reCAPTCHA flow and restarting the flow.`);const a=await pc(n,e,t,t==="getOobCode");return r(n,a)}else return Promise.reject(o)})}/**
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
 */function ju(n,e){const t=Ii(n,"auth");if(t.isInitialized()){const i=t.getImmediate(),o=t.getOptions();if(an(o,e??{}))return i;Ne(i,"already-initialized")}return t.initialize({options:e})}function Vp(n,e){const t=e?.persistence||[],r=(Array.isArray(t)?t:[t]).map(nt);e?.errorMap&&n._updateErrorMap(e.errorMap),n._initializeWithPersistence(r,e?.popupRedirectResolver)}function $u(n,e,t){const r=Ge(n);L(r._canInitEmulator,r,"emulator-config-failed"),L(/^https?:\/\//.test(e),r,"invalid-emulator-scheme");const i=!1,o=zu(e),{host:a,port:u}=Np(e),l=u===null?"":`:${u}`;r.config.emulator={url:`${o}//${a}${l}/`},r.settings.appVerificationDisabledForTesting=!0,r.emulatorConfig=Object.freeze({host:a,port:u,protocol:o.replace(":",""),options:Object.freeze({disableWarnings:i})}),Op()}function zu(n){const e=n.indexOf(":");return e<0?"":n.substr(0,e+1)}function Np(n){const e=zu(n),t=/(\/\/)?([^?#/]+)/.exec(n.substr(e.length));if(!t)return{host:"",port:null};const r=t[2].split("@").pop()||"",i=/^(\[[^\]]+\])(:|$)/.exec(r);if(i){const o=i[1];return{host:o,port:mc(r.substr(o.length+1))}}else{const[o,a]=r.split(":");return{host:o,port:mc(a)}}}function mc(n){if(!n)return null;const e=Number(n);return isNaN(e)?null:e}function Op(){function n(){const e=document.createElement("p"),t=e.style;e.innerText="Running in emulator mode. Do not use with production credentials.",t.position="fixed",t.width="100%",t.backgroundColor="#ffffff",t.border=".1em solid #000000",t.color="#b50000",t.bottom="0px",t.left="0px",t.margin="0px",t.zIndex="10000",t.textAlign="center",e.classList.add("firebase-emulator-warning"),document.body.appendChild(e)}typeof console<"u"&&typeof console.info=="function"&&console.info("WARNING: You are using the Auth Emulator, which is intended for local testing only.  Do not use with production credentials."),typeof window<"u"&&typeof document<"u"&&(document.readyState==="loading"?window.addEventListener("DOMContentLoaded",n):n())}/**
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
 */class Ai{constructor(e,t){this.providerId=e,this.signInMethod=t}toJSON(){return et("not implemented")}_getIdTokenResponse(e){return et("not implemented")}_linkToIdToken(e,t){return et("not implemented")}_getReauthenticationResolver(e){return et("not implemented")}}async function Mp(n,e){return xe(n,"POST","/v1/accounts:update",e)}async function Lp(n,e){return xe(n,"POST","/v1/accounts:signUp",e)}/**
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
 */async function xp(n,e){return vn(n,"POST","/v1/accounts:signInWithPassword",We(n,e))}async function Fp(n,e){return xe(n,"POST","/v1/accounts:sendOobCode",We(n,e))}async function Up(n,e){return Fp(n,e)}/**
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
 */async function Bp(n,e){return vn(n,"POST","/v1/accounts:signInWithEmailLink",We(n,e))}async function qp(n,e){return vn(n,"POST","/v1/accounts:signInWithEmailLink",We(n,e))}/**
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
 */class un extends Ai{constructor(e,t,r,i=null){super("password",r),this._email=e,this._password=t,this._tenantId=i}static _fromEmailAndPassword(e,t){return new un(e,t,"password")}static _fromEmailAndCode(e,t,r=null){return new un(e,t,"emailLink",r)}toJSON(){return{email:this._email,password:this._password,signInMethod:this.signInMethod,tenantId:this._tenantId}}static fromJSON(e){const t=typeof e=="string"?JSON.parse(e):e;if(t?.email&&t?.password){if(t.signInMethod==="password")return this._fromEmailAndPassword(t.email,t.password);if(t.signInMethod==="emailLink")return this._fromEmailAndCode(t.email,t.password,t.tenantId)}return null}async _getIdTokenResponse(e){switch(this.signInMethod){case"password":const t={returnSecureToken:!0,email:this._email,password:this._password,clientType:"CLIENT_TYPE_WEB"};return ci(e,t,"signInWithPassword",xp);case"emailLink":return Bp(e,{email:this._email,oobCode:this._password});default:Ne(e,"internal-error")}}async _linkToIdToken(e,t){switch(this.signInMethod){case"password":const r={idToken:t,returnSecureToken:!0,email:this._email,password:this._password,clientType:"CLIENT_TYPE_WEB"};return ci(e,r,"signUpPassword",Lp);case"emailLink":return qp(e,{idToken:t,email:this._email,oobCode:this._password});default:Ne(e,"internal-error")}}_getReauthenticationResolver(e){return this._getIdTokenResponse(e)}}/**
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
 */async function rn(n,e){return vn(n,"POST","/v1/accounts:signInWithIdp",We(n,e))}/**
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
 */const jp="http://localhost";class $e extends Ai{constructor(){super(...arguments),this.pendingToken=null}static _fromParams(e){const t=new $e(e.providerId,e.signInMethod);return e.idToken||e.accessToken?(e.idToken&&(t.idToken=e.idToken),e.accessToken&&(t.accessToken=e.accessToken),e.nonce&&!e.pendingToken&&(t.nonce=e.nonce),e.pendingToken&&(t.pendingToken=e.pendingToken)):e.oauthToken&&e.oauthTokenSecret?(t.accessToken=e.oauthToken,t.secret=e.oauthTokenSecret):Ne("argument-error"),t}toJSON(){return{idToken:this.idToken,accessToken:this.accessToken,secret:this.secret,nonce:this.nonce,pendingToken:this.pendingToken,providerId:this.providerId,signInMethod:this.signInMethod}}static fromJSON(e){const t=typeof e=="string"?JSON.parse(e):e,{providerId:r,signInMethod:i}=t,o=no(t,["providerId","signInMethod"]);if(!r||!i)return null;const a=new $e(r,i);return a.idToken=o.idToken||void 0,a.accessToken=o.accessToken||void 0,a.secret=o.secret,a.nonce=o.nonce,a.pendingToken=o.pendingToken||null,a}_getIdTokenResponse(e){const t=this.buildRequest();return rn(e,t)}_linkToIdToken(e,t){const r=this.buildRequest();return r.idToken=t,rn(e,r)}_getReauthenticationResolver(e){const t=this.buildRequest();return t.autoCreate=!1,rn(e,t)}buildRequest(){const e={requestUri:jp,returnSecureToken:!0};if(this.pendingToken)e.pendingToken=this.pendingToken;else{const t={};this.idToken&&(t.id_token=this.idToken),this.accessToken&&(t.access_token=this.accessToken),this.secret&&(t.oauth_token_secret=this.secret),t.providerId=this.providerId,this.nonce&&!this.pendingToken&&(t.nonce=this.nonce),e.postBody=pr(t)}return e}}/**
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
 */function $p(n){switch(n){case"recoverEmail":return"RECOVER_EMAIL";case"resetPassword":return"PASSWORD_RESET";case"signIn":return"EMAIL_SIGNIN";case"verifyEmail":return"VERIFY_EMAIL";case"verifyAndChangeEmail":return"VERIFY_AND_CHANGE_EMAIL";case"revertSecondFactorAddition":return"REVERT_SECOND_FACTOR_ADDITION";default:return null}}function zp(n){const e=Wn(Gn(n)).link,t=e?Wn(Gn(e)).deep_link_id:null,r=Wn(Gn(n)).deep_link_id;return(r?Wn(Gn(r)).link:null)||r||t||e||n}class Ri{constructor(e){var t,r,i,o,a,u;const l=Wn(Gn(e)),d=(t=l.apiKey)!==null&&t!==void 0?t:null,p=(r=l.oobCode)!==null&&r!==void 0?r:null,y=$p((i=l.mode)!==null&&i!==void 0?i:null);L(d&&p&&y,"argument-error"),this.apiKey=d,this.operation=y,this.code=p,this.continueUrl=(o=l.continueUrl)!==null&&o!==void 0?o:null,this.languageCode=(a=l.languageCode)!==null&&a!==void 0?a:null,this.tenantId=(u=l.tenantId)!==null&&u!==void 0?u:null}static parseLink(e){const t=zp(e);try{return new Ri(t)}catch{return null}}}/**
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
 */class Bt{constructor(){this.providerId=Bt.PROVIDER_ID}static credential(e,t){return un._fromEmailAndPassword(e,t)}static credentialWithLink(e,t){const r=Ri.parseLink(t);return L(r,"argument-error"),un._fromEmailAndCode(e,r.code,r.tenantId)}}Bt.PROVIDER_ID="password";Bt.EMAIL_PASSWORD_SIGN_IN_METHOD="password";Bt.EMAIL_LINK_SIGN_IN_METHOD="emailLink";/**
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
 */class Pi{constructor(e){this.providerId=e,this.defaultLanguageCode=null,this.customParameters={}}setDefaultLanguage(e){this.defaultLanguageCode=e}setCustomParameters(e){return this.customParameters=e,this}getCustomParameters(){return this.customParameters}}/**
 * @license
 * Copyright 2019 Google LLC
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
 */class En extends Pi{constructor(){super(...arguments),this.scopes=[]}addScope(e){return this.scopes.includes(e)||this.scopes.push(e),this}getScopes(){return[...this.scopes]}}class Xn extends En{static credentialFromJSON(e){const t=typeof e=="string"?JSON.parse(e):e;return L("providerId"in t&&"signInMethod"in t,"argument-error"),$e._fromParams(t)}credential(e){return this._credential(Object.assign(Object.assign({},e),{nonce:e.rawNonce}))}_credential(e){return L(e.idToken||e.accessToken,"argument-error"),$e._fromParams(Object.assign(Object.assign({},e),{providerId:this.providerId,signInMethod:this.providerId}))}static credentialFromResult(e){return Xn.oauthCredentialFromTaggedObject(e)}static credentialFromError(e){return Xn.oauthCredentialFromTaggedObject(e.customData||{})}static oauthCredentialFromTaggedObject({_tokenResponse:e}){if(!e)return null;const{oauthIdToken:t,oauthAccessToken:r,oauthTokenSecret:i,pendingToken:o,nonce:a,providerId:u}=e;if(!r&&!i&&!t&&!o||!u)return null;try{return new Xn(u)._credential({idToken:t,accessToken:r,nonce:a,pendingToken:o})}catch{return null}}}/**
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
 */class Ye extends En{constructor(){super("facebook.com")}static credential(e){return $e._fromParams({providerId:Ye.PROVIDER_ID,signInMethod:Ye.FACEBOOK_SIGN_IN_METHOD,accessToken:e})}static credentialFromResult(e){return Ye.credentialFromTaggedObject(e)}static credentialFromError(e){return Ye.credentialFromTaggedObject(e.customData||{})}static credentialFromTaggedObject({_tokenResponse:e}){if(!e||!("oauthAccessToken"in e)||!e.oauthAccessToken)return null;try{return Ye.credential(e.oauthAccessToken)}catch{return null}}}Ye.FACEBOOK_SIGN_IN_METHOD="facebook.com";Ye.PROVIDER_ID="facebook.com";/**
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
 */class Xe extends En{constructor(){super("google.com"),this.addScope("profile")}static credential(e,t){return $e._fromParams({providerId:Xe.PROVIDER_ID,signInMethod:Xe.GOOGLE_SIGN_IN_METHOD,idToken:e,accessToken:t})}static credentialFromResult(e){return Xe.credentialFromTaggedObject(e)}static credentialFromError(e){return Xe.credentialFromTaggedObject(e.customData||{})}static credentialFromTaggedObject({_tokenResponse:e}){if(!e)return null;const{oauthIdToken:t,oauthAccessToken:r}=e;if(!t&&!r)return null;try{return Xe.credential(t,r)}catch{return null}}}Xe.GOOGLE_SIGN_IN_METHOD="google.com";Xe.PROVIDER_ID="google.com";/**
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
 */class Je extends En{constructor(){super("github.com")}static credential(e){return $e._fromParams({providerId:Je.PROVIDER_ID,signInMethod:Je.GITHUB_SIGN_IN_METHOD,accessToken:e})}static credentialFromResult(e){return Je.credentialFromTaggedObject(e)}static credentialFromError(e){return Je.credentialFromTaggedObject(e.customData||{})}static credentialFromTaggedObject({_tokenResponse:e}){if(!e||!("oauthAccessToken"in e)||!e.oauthAccessToken)return null;try{return Je.credential(e.oauthAccessToken)}catch{return null}}}Je.GITHUB_SIGN_IN_METHOD="github.com";Je.PROVIDER_ID="github.com";/**
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
 */class Ze extends En{constructor(){super("twitter.com")}static credential(e,t){return $e._fromParams({providerId:Ze.PROVIDER_ID,signInMethod:Ze.TWITTER_SIGN_IN_METHOD,oauthToken:e,oauthTokenSecret:t})}static credentialFromResult(e){return Ze.credentialFromTaggedObject(e)}static credentialFromError(e){return Ze.credentialFromTaggedObject(e.customData||{})}static credentialFromTaggedObject({_tokenResponse:e}){if(!e)return null;const{oauthAccessToken:t,oauthTokenSecret:r}=e;if(!t||!r)return null;try{return Ze.credential(t,r)}catch{return null}}}Ze.TWITTER_SIGN_IN_METHOD="twitter.com";Ze.PROVIDER_ID="twitter.com";/**
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
 */async function Wp(n,e){return vn(n,"POST","/v1/accounts:signUp",We(n,e))}/**
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
 */class vt{constructor(e){this.user=e.user,this.providerId=e.providerId,this._tokenResponse=e._tokenResponse,this.operationType=e.operationType}static async _fromIdTokenResponse(e,t,r,i=!1){const o=await tt._fromIdTokenResponse(e,r,i),a=gc(r);return new vt({user:o,providerId:a,_tokenResponse:r,operationType:t})}static async _forOperation(e,t,r){await e._updateTokensIfNecessary(r,!0);const i=gc(r);return new vt({user:e,providerId:i,_tokenResponse:r,operationType:t})}}function gc(n){return n.providerId?n.providerId:"phoneNumber"in n?"phone":null}/**
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
 */class ui extends at{constructor(e,t,r,i){var o;super(t.code,t.message),this.operationType=r,this.user=i,Object.setPrototypeOf(this,ui.prototype),this.customData={appName:e.name,tenantId:(o=e.tenantId)!==null&&o!==void 0?o:void 0,_serverResponse:t.customData._serverResponse,operationType:r}}static _fromErrorAndOperation(e,t,r,i){return new ui(e,t,r,i)}}function Wu(n,e,t,r){return(e==="reauthenticate"?t._getReauthenticationResolver(n):t._getIdTokenResponse(n)).catch(o=>{throw o.code==="auth/multi-factor-auth-required"?ui._fromErrorAndOperation(n,o,e,r):o})}async function Gp(n,e,t=!1){const r=await Mt(n,e._linkToIdToken(n.auth,await n.getIdToken()),t);return vt._forOperation(n,"link",r)}/**
 * @license
 * Copyright 2019 Google LLC
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
 */async function Gu(n,e,t=!1){const{auth:r}=n;if(Ce(r.app))return Promise.reject(Ue(r));const i="reauthenticate";try{const o=await Mt(n,Wu(r,i,e,n),t);L(o.idToken,r,"internal-error");const a=oo(o.idToken);L(a,r,"internal-error");const{sub:u}=a;return L(n.uid===u,r,"user-mismatch"),vt._forOperation(n,i,o)}catch(o){throw o?.code==="auth/user-not-found"&&Ne(r,"user-mismatch"),o}}/**
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
 */async function Hu(n,e,t=!1){if(Ce(n.app))return Promise.reject(Ue(n));const r="signIn",i=await Wu(n,r,e),o=await vt._fromIdTokenResponse(n,r,i);return t||await n._updateCurrentUser(o.user),o}async function Ku(n,e){return Hu(Ge(n),e)}async function Hp(n,e){return Gu(Q(n),e)}/**
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
 */async function Kp(n,e){return vn(n,"POST","/v1/accounts:signInWithCustomToken",We(n,e))}/**
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
 */async function Qp(n,e){if(Ce(n.app))return Promise.reject(Ue(n));const t=Ge(n),r=await Kp(t,{token:e,returnSecureToken:!0}),i=await vt._fromIdTokenResponse(t,"signIn",r);return await t._updateCurrentUser(i.user),i}/**
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
 */async function Qu(n){const e=Ge(n);e._getPasswordPolicyInternal()&&await e._updatePasswordPolicy()}async function Yp(n,e,t){const r=Ge(n);await ci(r,{requestType:"PASSWORD_RESET",email:e,clientType:"CLIENT_TYPE_WEB"},"getOobCode",Up)}async function Xp(n,e,t){if(Ce(n.app))return Promise.reject(Ue(n));const r=Ge(n),a=await ci(r,{returnSecureToken:!0,email:e,password:t,clientType:"CLIENT_TYPE_WEB"},"signUpPassword",Wp).catch(l=>{throw l.code==="auth/password-does-not-meet-requirements"&&Qu(n),l}),u=await vt._fromIdTokenResponse(r,"signIn",a);return await r._updateCurrentUser(u.user),u}function Jp(n,e,t){return Ce(n.app)?Promise.reject(Ue(n)):Ku(Q(n),Bt.credential(e,t)).catch(async r=>{throw r.code==="auth/password-does-not-meet-requirements"&&Qu(n),r})}/**
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
 */async function Zp(n,e){return xe(n,"POST","/v1/accounts:update",e)}/**
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
 */async function em(n,{displayName:e,photoURL:t}){if(e===void 0&&t===void 0)return;const r=Q(n),o={idToken:await r.getIdToken(),displayName:e,photoUrl:t,returnSecureToken:!0},a=await Mt(r,Zp(r.auth,o));r.displayName=a.displayName||null,r.photoURL=a.photoUrl||null;const u=r.providerData.find(({providerId:l})=>l==="password");u&&(u.displayName=r.displayName,u.photoURL=r.photoURL),await r._updateTokensIfNecessary(a)}function tm(n,e){return nm(Q(n),null,e)}async function nm(n,e,t){const{auth:r}=n,o={idToken:await n.getIdToken(),returnSecureToken:!0};t&&(o.password=t);const a=await Mt(n,Mp(r,o));await n._updateTokensIfNecessary(a,!0)}/**
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
 */function rm(n,e){return Q(n).setPersistence(e)}function Yu(n,e,t,r){return Q(n).onIdTokenChanged(e,t,r)}function Xu(n,e,t){return Q(n).beforeAuthStateChanged(e,t)}function im(n,e,t,r){return Q(n).onAuthStateChanged(e,t,r)}function sm(n){return Q(n).signOut()}async function om(n){return Q(n).delete()}const li="__sak";/**
 * @license
 * Copyright 2019 Google LLC
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
 */class Ju{constructor(e,t){this.storageRetriever=e,this.type=t}_isAvailable(){try{return this.storage?(this.storage.setItem(li,"1"),this.storage.removeItem(li),Promise.resolve(!0)):Promise.resolve(!1)}catch{return Promise.resolve(!1)}}_set(e,t){return this.storage.setItem(e,JSON.stringify(t)),Promise.resolve()}_get(e){const t=this.storage.getItem(e);return Promise.resolve(t?JSON.parse(t):null)}_remove(e){return this.storage.removeItem(e),Promise.resolve()}get storage(){return this.storageRetriever()}}/**
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
 */function am(){const n=ge();return ao(n)||Ti(n)}const cm=1e3,um=10;class Zu extends Ju{constructor(){super(()=>window.localStorage,"LOCAL"),this.boundEventHandler=(e,t)=>this.onStorageEvent(e,t),this.listeners={},this.localCache={},this.pollTimer=null,this.safariLocalStorageNotSynced=am()&&vp(),this.fallbackToPolling=Uu(),this._shouldAllowMigration=!0}forAllChangedKeys(e){for(const t of Object.keys(this.listeners)){const r=this.storage.getItem(t),i=this.localCache[t];r!==i&&e(t,i,r)}}onStorageEvent(e,t=!1){if(!e.key){this.forAllChangedKeys((a,u,l)=>{this.notifyListeners(a,l)});return}const r=e.key;if(t?this.detachListener():this.stopPolling(),this.safariLocalStorageNotSynced){const a=this.storage.getItem(r);if(e.newValue!==a)e.newValue!==null?this.storage.setItem(r,e.newValue):this.storage.removeItem(r);else if(this.localCache[r]===e.newValue&&!t)return}const i=()=>{const a=this.storage.getItem(r);!t&&this.localCache[r]===a||this.notifyListeners(r,a)},o=this.storage.getItem(r);yp()&&o!==e.newValue&&e.newValue!==e.oldValue?setTimeout(i,um):i()}notifyListeners(e,t){this.localCache[e]=t;const r=this.listeners[e];if(r)for(const i of Array.from(r))i(t&&JSON.parse(t))}startPolling(){this.stopPolling(),this.pollTimer=setInterval(()=>{this.forAllChangedKeys((e,t,r)=>{this.onStorageEvent(new StorageEvent("storage",{key:e,oldValue:t,newValue:r}),!0)})},cm)}stopPolling(){this.pollTimer&&(clearInterval(this.pollTimer),this.pollTimer=null)}attachListener(){window.addEventListener("storage",this.boundEventHandler)}detachListener(){window.removeEventListener("storage",this.boundEventHandler)}_addListener(e,t){Object.keys(this.listeners).length===0&&(this.fallbackToPolling?this.startPolling():this.attachListener()),this.listeners[e]||(this.listeners[e]=new Set,this.localCache[e]=this.storage.getItem(e)),this.listeners[e].add(t)}_removeListener(e,t){this.listeners[e]&&(this.listeners[e].delete(t),this.listeners[e].size===0&&delete this.listeners[e]),Object.keys(this.listeners).length===0&&(this.detachListener(),this.stopPolling())}async _set(e,t){await super._set(e,t),this.localCache[e]=JSON.stringify(t)}async _get(e){const t=await super._get(e);return this.localCache[e]=JSON.stringify(t),t}async _remove(e){await super._remove(e),delete this.localCache[e]}}Zu.type="LOCAL";const el=Zu;/**
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
 */class tl extends Ju{constructor(){super(()=>window.sessionStorage,"SESSION")}_addListener(e,t){}_removeListener(e,t){}}tl.type="SESSION";const co=tl;/**
 * @license
 * Copyright 2019 Google LLC
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
 */function lm(n){return Promise.all(n.map(async e=>{try{return{fulfilled:!0,value:await e}}catch(t){return{fulfilled:!1,reason:t}}}))}/**
 * @license
 * Copyright 2019 Google LLC
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
 */class Si{constructor(e){this.eventTarget=e,this.handlersMap={},this.boundEventHandler=this.handleEvent.bind(this)}static _getInstance(e){const t=this.receivers.find(i=>i.isListeningto(e));if(t)return t;const r=new Si(e);return this.receivers.push(r),r}isListeningto(e){return this.eventTarget===e}async handleEvent(e){const t=e,{eventId:r,eventType:i,data:o}=t.data,a=this.handlersMap[i];if(!a?.size)return;t.ports[0].postMessage({status:"ack",eventId:r,eventType:i});const u=Array.from(a).map(async d=>d(t.origin,o)),l=await lm(u);t.ports[0].postMessage({status:"done",eventId:r,eventType:i,response:l})}_subscribe(e,t){Object.keys(this.handlersMap).length===0&&this.eventTarget.addEventListener("message",this.boundEventHandler),this.handlersMap[e]||(this.handlersMap[e]=new Set),this.handlersMap[e].add(t)}_unsubscribe(e,t){this.handlersMap[e]&&t&&this.handlersMap[e].delete(t),(!t||this.handlersMap[e].size===0)&&delete this.handlersMap[e],Object.keys(this.handlersMap).length===0&&this.eventTarget.removeEventListener("message",this.boundEventHandler)}}Si.receivers=[];/**
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
 */function uo(n="",e=10){let t="";for(let r=0;r<e;r++)t+=Math.floor(Math.random()*10);return n+t}/**
 * @license
 * Copyright 2019 Google LLC
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
 */class hm{constructor(e){this.target=e,this.handlers=new Set}removeMessageHandler(e){e.messageChannel&&(e.messageChannel.port1.removeEventListener("message",e.onMessage),e.messageChannel.port1.close()),this.handlers.delete(e)}async _send(e,t,r=50){const i=typeof MessageChannel<"u"?new MessageChannel:null;if(!i)throw new Error("connection_unavailable");let o,a;return new Promise((u,l)=>{const d=uo("",20);i.port1.start();const p=setTimeout(()=>{l(new Error("unsupported_event"))},r);a={messageChannel:i,onMessage(y){const T=y;if(T.data.eventId===d)switch(T.data.status){case"ack":clearTimeout(p),o=setTimeout(()=>{l(new Error("timeout"))},3e3);break;case"done":clearTimeout(o),u(T.data.response);break;default:clearTimeout(p),clearTimeout(o),l(new Error("invalid_response"));break}}},this.handlers.add(a),i.port1.addEventListener("message",a.onMessage),this.target.postMessage({eventType:e,eventId:d,data:t},[i.port2])}).finally(()=>{a&&this.removeMessageHandler(a)})}}/**
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
 */function Be(){return window}function dm(n){Be().location.href=n}/**
 * @license
 * Copyright 2020 Google LLC.
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
 */function nl(){return typeof Be().WorkerGlobalScope<"u"&&typeof Be().importScripts=="function"}async function fm(){if(!navigator?.serviceWorker)return null;try{return(await navigator.serviceWorker.ready).active}catch{return null}}function pm(){var n;return((n=navigator?.serviceWorker)===null||n===void 0?void 0:n.controller)||null}function mm(){return nl()?self:null}/**
 * @license
 * Copyright 2019 Google LLC
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
 */const rl="firebaseLocalStorageDb",gm=1,hi="firebaseLocalStorage",il="fbase_key";class gr{constructor(e){this.request=e}toPromise(){return new Promise((e,t)=>{this.request.addEventListener("success",()=>{e(this.request.result)}),this.request.addEventListener("error",()=>{t(this.request.error)})})}}function Ci(n,e){return n.transaction([hi],e?"readwrite":"readonly").objectStore(hi)}function _m(){const n=indexedDB.deleteDatabase(rl);return new gr(n).toPromise()}function Bs(){const n=indexedDB.open(rl,gm);return new Promise((e,t)=>{n.addEventListener("error",()=>{t(n.error)}),n.addEventListener("upgradeneeded",()=>{const r=n.result;try{r.createObjectStore(hi,{keyPath:il})}catch(i){t(i)}}),n.addEventListener("success",async()=>{const r=n.result;r.objectStoreNames.contains(hi)?e(r):(r.close(),await _m(),e(await Bs()))})})}async function _c(n,e,t){const r=Ci(n,!0).put({[il]:e,value:t});return new gr(r).toPromise()}async function ym(n,e){const t=Ci(n,!1).get(e),r=await new gr(t).toPromise();return r===void 0?null:r.value}function yc(n,e){const t=Ci(n,!0).delete(e);return new gr(t).toPromise()}const vm=800,Em=3;class sl{constructor(){this.type="LOCAL",this._shouldAllowMigration=!0,this.listeners={},this.localCache={},this.pollTimer=null,this.pendingWrites=0,this.receiver=null,this.sender=null,this.serviceWorkerReceiverAvailable=!1,this.activeServiceWorker=null,this._workerInitializationPromise=this.initializeServiceWorkerMessaging().then(()=>{},()=>{})}async _openDb(){return this.db?this.db:(this.db=await Bs(),this.db)}async _withRetries(e){let t=0;for(;;)try{const r=await this._openDb();return await e(r)}catch(r){if(t++>Em)throw r;this.db&&(this.db.close(),this.db=void 0)}}async initializeServiceWorkerMessaging(){return nl()?this.initializeReceiver():this.initializeSender()}async initializeReceiver(){this.receiver=Si._getInstance(mm()),this.receiver._subscribe("keyChanged",async(e,t)=>({keyProcessed:(await this._poll()).includes(t.key)})),this.receiver._subscribe("ping",async(e,t)=>["keyChanged"])}async initializeSender(){var e,t;if(this.activeServiceWorker=await fm(),!this.activeServiceWorker)return;this.sender=new hm(this.activeServiceWorker);const r=await this.sender._send("ping",{},800);r&&!((e=r[0])===null||e===void 0)&&e.fulfilled&&!((t=r[0])===null||t===void 0)&&t.value.includes("keyChanged")&&(this.serviceWorkerReceiverAvailable=!0)}async notifyServiceWorker(e){if(!(!this.sender||!this.activeServiceWorker||pm()!==this.activeServiceWorker))try{await this.sender._send("keyChanged",{key:e},this.serviceWorkerReceiverAvailable?800:50)}catch{}}async _isAvailable(){try{if(!indexedDB)return!1;const e=await Bs();return await _c(e,li,"1"),await yc(e,li),!0}catch{}return!1}async _withPendingWrite(e){this.pendingWrites++;try{await e()}finally{this.pendingWrites--}}async _set(e,t){return this._withPendingWrite(async()=>(await this._withRetries(r=>_c(r,e,t)),this.localCache[e]=t,this.notifyServiceWorker(e)))}async _get(e){const t=await this._withRetries(r=>ym(r,e));return this.localCache[e]=t,t}async _remove(e){return this._withPendingWrite(async()=>(await this._withRetries(t=>yc(t,e)),delete this.localCache[e],this.notifyServiceWorker(e)))}async _poll(){const e=await this._withRetries(i=>{const o=Ci(i,!1).getAll();return new gr(o).toPromise()});if(!e)return[];if(this.pendingWrites!==0)return[];const t=[],r=new Set;if(e.length!==0)for(const{fbase_key:i,value:o}of e)r.add(i),JSON.stringify(this.localCache[i])!==JSON.stringify(o)&&(this.notifyListeners(i,o),t.push(i));for(const i of Object.keys(this.localCache))this.localCache[i]&&!r.has(i)&&(this.notifyListeners(i,null),t.push(i));return t}notifyListeners(e,t){this.localCache[e]=t;const r=this.listeners[e];if(r)for(const i of Array.from(r))i(t)}startPolling(){this.stopPolling(),this.pollTimer=setInterval(async()=>this._poll(),vm)}stopPolling(){this.pollTimer&&(clearInterval(this.pollTimer),this.pollTimer=null)}_addListener(e,t){Object.keys(this.listeners).length===0&&this.startPolling(),this.listeners[e]||(this.listeners[e]=new Set,this._get(e)),this.listeners[e].add(t)}_removeListener(e,t){this.listeners[e]&&(this.listeners[e].delete(t),this.listeners[e].size===0&&delete this.listeners[e]),Object.keys(this.listeners).length===0&&this.stopPolling()}}sl.type="LOCAL";const ol=sl;new mr(3e4,6e4);/**
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
 */function lo(n,e){return e?nt(e):(L(n._popupRedirectResolver,n,"argument-error"),n._popupRedirectResolver)}/**
 * @license
 * Copyright 2019 Google LLC
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
 */class ho extends Ai{constructor(e){super("custom","custom"),this.params=e}_getIdTokenResponse(e){return rn(e,this._buildIdpRequest())}_linkToIdToken(e,t){return rn(e,this._buildIdpRequest(t))}_getReauthenticationResolver(e){return rn(e,this._buildIdpRequest())}_buildIdpRequest(e){const t={requestUri:this.params.requestUri,sessionId:this.params.sessionId,postBody:this.params.postBody,tenantId:this.params.tenantId,pendingToken:this.params.pendingToken,returnSecureToken:!0,returnIdpCredential:!0};return e&&(t.idToken=e),t}}function Im(n){return Hu(n.auth,new ho(n),n.bypassAuthState)}function Tm(n){const{auth:e,user:t}=n;return L(t,e,"internal-error"),Gu(t,new ho(n),n.bypassAuthState)}async function wm(n){const{auth:e,user:t}=n;return L(t,e,"internal-error"),Gp(t,new ho(n),n.bypassAuthState)}/**
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
 */class al{constructor(e,t,r,i,o=!1){this.auth=e,this.resolver=r,this.user=i,this.bypassAuthState=o,this.pendingPromise=null,this.eventManager=null,this.filter=Array.isArray(t)?t:[t]}execute(){return new Promise(async(e,t)=>{this.pendingPromise={resolve:e,reject:t};try{this.eventManager=await this.resolver._initialize(this.auth),await this.onExecution(),this.eventManager.registerConsumer(this)}catch(r){this.reject(r)}})}async onAuthEvent(e){const{urlResponse:t,sessionId:r,postBody:i,tenantId:o,error:a,type:u}=e;if(a){this.reject(a);return}const l={auth:this.auth,requestUri:t,sessionId:r,tenantId:o||void 0,postBody:i||void 0,user:this.user,bypassAuthState:this.bypassAuthState};try{this.resolve(await this.getIdpTask(u)(l))}catch(d){this.reject(d)}}onError(e){this.reject(e)}getIdpTask(e){switch(e){case"signInViaPopup":case"signInViaRedirect":return Im;case"linkViaPopup":case"linkViaRedirect":return wm;case"reauthViaPopup":case"reauthViaRedirect":return Tm;default:Ne(this.auth,"internal-error")}}resolve(e){it(this.pendingPromise,"Pending promise was never set"),this.pendingPromise.resolve(e),this.unregisterAndCleanUp()}reject(e){it(this.pendingPromise,"Pending promise was never set"),this.pendingPromise.reject(e),this.unregisterAndCleanUp()}unregisterAndCleanUp(){this.eventManager&&this.eventManager.unregisterConsumer(this),this.pendingPromise=null,this.cleanUp()}}/**
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
 */const Am=new mr(2e3,1e4);async function Rm(n,e,t){if(Ce(n.app))return Promise.reject(Ve(n,"operation-not-supported-in-this-environment"));const r=Ge(n);Au(n,e,Pi);const i=lo(r,t);return new pt(r,"signInViaPopup",e,i).executeNotNull()}async function Pm(n,e,t){const r=Q(n);if(Ce(r.auth.app))return Promise.reject(Ve(r.auth,"operation-not-supported-in-this-environment"));Au(r.auth,e,Pi);const i=lo(r.auth,t);return new pt(r.auth,"reauthViaPopup",e,i,r).executeNotNull()}class pt extends al{constructor(e,t,r,i,o){super(e,t,i,o),this.provider=r,this.authWindow=null,this.pollId=null,pt.currentPopupAction&&pt.currentPopupAction.cancel(),pt.currentPopupAction=this}async executeNotNull(){const e=await this.execute();return L(e,this.auth,"internal-error"),e}async onExecution(){it(this.filter.length===1,"Popup operations only handle one event");const e=uo();this.authWindow=await this.resolver._openPopup(this.auth,this.provider,this.filter[0],e),this.authWindow.associatedEvent=e,this.resolver._originValidation(this.auth).catch(t=>{this.reject(t)}),this.resolver._isIframeWebStorageSupported(this.auth,t=>{t||this.reject(Ve(this.auth,"web-storage-unsupported"))}),this.pollUserCancellation()}get eventId(){var e;return((e=this.authWindow)===null||e===void 0?void 0:e.associatedEvent)||null}cancel(){this.reject(Ve(this.auth,"cancelled-popup-request"))}cleanUp(){this.authWindow&&this.authWindow.close(),this.pollId&&window.clearTimeout(this.pollId),this.authWindow=null,this.pollId=null,pt.currentPopupAction=null}pollUserCancellation(){const e=()=>{var t,r;if(!((r=(t=this.authWindow)===null||t===void 0?void 0:t.window)===null||r===void 0)&&r.closed){this.pollId=window.setTimeout(()=>{this.pollId=null,this.reject(Ve(this.auth,"popup-closed-by-user"))},8e3);return}this.pollId=window.setTimeout(e,Am.get())};e()}}pt.currentPopupAction=null;/**
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
 */const Sm="pendingRedirect",Zr=new Map;class Cm extends al{constructor(e,t,r=!1){super(e,["signInViaRedirect","linkViaRedirect","reauthViaRedirect","unknown"],t,void 0,r),this.eventId=null}async execute(){let e=Zr.get(this.auth._key());if(!e){try{const r=await bm(this.resolver,this.auth)?await super.execute():null;e=()=>Promise.resolve(r)}catch(t){e=()=>Promise.reject(t)}Zr.set(this.auth._key(),e)}return this.bypassAuthState||Zr.set(this.auth._key(),()=>Promise.resolve(null)),e()}async onAuthEvent(e){if(e.type==="signInViaRedirect")return super.onAuthEvent(e);if(e.type==="unknown"){this.resolve(null);return}if(e.eventId){const t=await this.auth._redirectUserForId(e.eventId);if(t)return this.user=t,super.onAuthEvent(e);this.resolve(null)}}async onExecution(){}cleanUp(){}}async function bm(n,e){const t=Vm(e),r=Dm(n);if(!await r._isAvailable())return!1;const i=await r._get(t)==="true";return await r._remove(t),i}function km(n,e){Zr.set(n._key(),e)}function Dm(n){return nt(n._redirectPersistence)}function Vm(n){return Jr(Sm,n.config.apiKey,n.name)}async function Nm(n,e,t=!1){if(Ce(n.app))return Promise.reject(Ue(n));const r=Ge(n),i=lo(r,e),a=await new Cm(r,i,t).execute();return a&&!t&&(delete a.user._redirectEventId,await r._persistUserIfCurrent(a.user),await r._setRedirectUser(null,e)),a}/**
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
 */const Om=600*1e3;class Mm{constructor(e){this.auth=e,this.cachedEventUids=new Set,this.consumers=new Set,this.queuedRedirectEvent=null,this.hasHandledPotentialRedirect=!1,this.lastProcessedEventTime=Date.now()}registerConsumer(e){this.consumers.add(e),this.queuedRedirectEvent&&this.isEventForConsumer(this.queuedRedirectEvent,e)&&(this.sendToConsumer(this.queuedRedirectEvent,e),this.saveEventToCache(this.queuedRedirectEvent),this.queuedRedirectEvent=null)}unregisterConsumer(e){this.consumers.delete(e)}onEvent(e){if(this.hasEventBeenHandled(e))return!1;let t=!1;return this.consumers.forEach(r=>{this.isEventForConsumer(e,r)&&(t=!0,this.sendToConsumer(e,r),this.saveEventToCache(e))}),this.hasHandledPotentialRedirect||!Lm(e)||(this.hasHandledPotentialRedirect=!0,t||(this.queuedRedirectEvent=e,t=!0)),t}sendToConsumer(e,t){var r;if(e.error&&!cl(e)){const i=((r=e.error.code)===null||r===void 0?void 0:r.split("auth/")[1])||"internal-error";t.onError(Ve(this.auth,i))}else t.onAuthEvent(e)}isEventForConsumer(e,t){const r=t.eventId===null||!!e.eventId&&e.eventId===t.eventId;return t.filter.includes(e.type)&&r}hasEventBeenHandled(e){return Date.now()-this.lastProcessedEventTime>=Om&&this.cachedEventUids.clear(),this.cachedEventUids.has(vc(e))}saveEventToCache(e){this.cachedEventUids.add(vc(e)),this.lastProcessedEventTime=Date.now()}}function vc(n){return[n.type,n.eventId,n.sessionId,n.tenantId].filter(e=>e).join("-")}function cl({type:n,error:e}){return n==="unknown"&&e?.code==="auth/no-auth-event"}function Lm(n){switch(n.type){case"signInViaRedirect":case"linkViaRedirect":case"reauthViaRedirect":return!0;case"unknown":return cl(n);default:return!1}}/**
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
 */async function xm(n,e={}){return xe(n,"GET","/v1/projects",e)}/**
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
 */const Fm=/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/,Um=/^https?/;async function Bm(n){if(n.config.emulator)return;const{authorizedDomains:e}=await xm(n);for(const t of e)try{if(qm(t))return}catch{}Ne(n,"unauthorized-domain")}function qm(n){const e=xs(),{protocol:t,hostname:r}=new URL(e);if(n.startsWith("chrome-extension://")){const a=new URL(n);return a.hostname===""&&r===""?t==="chrome-extension:"&&n.replace("chrome-extension://","")===e.replace("chrome-extension://",""):t==="chrome-extension:"&&a.hostname===r}if(!Um.test(t))return!1;if(Fm.test(n))return r===n;const i=n.replace(/\./g,"\\.");return new RegExp("^(.+\\."+i+"|"+i+")$","i").test(r)}/**
 * @license
 * Copyright 2020 Google LLC.
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
 */const jm=new mr(3e4,6e4);function Ec(){const n=Be().___jsl;if(n?.H){for(const e of Object.keys(n.H))if(n.H[e].r=n.H[e].r||[],n.H[e].L=n.H[e].L||[],n.H[e].r=[...n.H[e].L],n.CP)for(let t=0;t<n.CP.length;t++)n.CP[t]=null}}function $m(n){return new Promise((e,t)=>{var r,i,o;function a(){Ec(),gapi.load("gapi.iframes",{callback:()=>{e(gapi.iframes.getContext())},ontimeout:()=>{Ec(),t(Ve(n,"network-request-failed"))},timeout:jm.get()})}if(!((i=(r=Be().gapi)===null||r===void 0?void 0:r.iframes)===null||i===void 0)&&i.Iframe)e(gapi.iframes.getContext());else if(!((o=Be().gapi)===null||o===void 0)&&o.load)a();else{const u=Cp("iframefcb");return Be()[u]=()=>{gapi.load?a():t(Ve(n,"network-request-failed"))},qu(`${Sp()}?onload=${u}`).catch(l=>t(l))}}).catch(e=>{throw ei=null,e})}let ei=null;function zm(n){return ei=ei||$m(n),ei}/**
 * @license
 * Copyright 2020 Google LLC.
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
 */const Wm=new mr(5e3,15e3),Gm="__/auth/iframe",Hm="emulator/auth/iframe",Km={style:{position:"absolute",top:"-100px",width:"1px",height:"1px"},"aria-hidden":"true",tabindex:"-1"},Qm=new Map([["identitytoolkit.googleapis.com","p"],["staging-identitytoolkit.sandbox.googleapis.com","s"],["test-identitytoolkit.sandbox.googleapis.com","t"]]);function Ym(n){const e=n.config;L(e.authDomain,n,"auth-domain-config-required");const t=e.emulator?so(e,Hm):`https://${n.config.authDomain}/${Gm}`,r={apiKey:e.apiKey,appName:n.name,v:yn},i=Qm.get(n.config.apiHost);i&&(r.eid=i);const o=n._getFrameworks();return o.length&&(r.fw=o.join(",")),`${t}?${pr(r).slice(1)}`}async function Xm(n){const e=await zm(n),t=Be().gapi;return L(t,n,"internal-error"),e.open({where:document.body,url:Ym(n),messageHandlersFilter:t.iframes.CROSS_ORIGIN_IFRAMES_FILTER,attributes:Km,dontclear:!0},r=>new Promise(async(i,o)=>{await r.restyle({setHideOnLeave:!1});const a=Ve(n,"network-request-failed"),u=Be().setTimeout(()=>{o(a)},Wm.get());function l(){Be().clearTimeout(u),i(r)}r.ping(l).then(l,()=>{o(a)})}))}/**
 * @license
 * Copyright 2020 Google LLC.
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
 */const Jm={location:"yes",resizable:"yes",statusbar:"yes",toolbar:"no"},Zm=500,eg=600,tg="_blank",ng="http://localhost";class Ic{constructor(e){this.window=e,this.associatedEvent=null}close(){if(this.window)try{this.window.close()}catch{}}}function rg(n,e,t,r=Zm,i=eg){const o=Math.max((window.screen.availHeight-i)/2,0).toString(),a=Math.max((window.screen.availWidth-r)/2,0).toString();let u="";const l=Object.assign(Object.assign({},Jm),{width:r.toString(),height:i.toString(),top:o,left:a}),d=ge().toLowerCase();t&&(u=Ou(d)?tg:t),Nu(d)&&(e=e||ng,l.scrollbars="yes");const p=Object.entries(l).reduce((T,[S,V])=>`${T}${S}=${V},`,"");if(_p(d)&&u!=="_self")return ig(e||"",u),new Ic(null);const y=window.open(e||"",u,p);L(y,n,"popup-blocked");try{y.focus()}catch{}return new Ic(y)}function ig(n,e){const t=document.createElement("a");t.href=n,t.target=e;const r=document.createEvent("MouseEvent");r.initMouseEvent("click",!0,!0,window,1,0,0,0,0,!1,!1,!1,!1,1,null),t.dispatchEvent(r)}/**
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
 */const sg="__/auth/handler",og="emulator/auth/handler",ag=encodeURIComponent("fac");async function Tc(n,e,t,r,i,o){L(n.config.authDomain,n,"auth-domain-config-required"),L(n.config.apiKey,n,"invalid-api-key");const a={apiKey:n.config.apiKey,appName:n.name,authType:t,redirectUrl:r,v:yn,eventId:i};if(e instanceof Pi){e.setDefaultLanguage(n.languageCode),a.providerId=e.providerId||"",xd(e.getCustomParameters())||(a.customParameters=JSON.stringify(e.getCustomParameters()));for(const[p,y]of Object.entries({}))a[p]=y}if(e instanceof En){const p=e.getScopes().filter(y=>y!=="");p.length>0&&(a.scopes=p.join(","))}n.tenantId&&(a.tid=n.tenantId);const u=a;for(const p of Object.keys(u))u[p]===void 0&&delete u[p];const l=await n._getAppCheckToken(),d=l?`#${ag}=${encodeURIComponent(l)}`:"";return`${cg(n)}?${pr(u).slice(1)}${d}`}function cg({config:n}){return n.emulator?so(n,og):`https://${n.authDomain}/${sg}`}/**
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
 */const Cs="webStorageSupport";class ug{constructor(){this.eventManagers={},this.iframes={},this.originValidationPromises={},this._redirectPersistence=co,this._completeRedirectFn=Nm,this._overrideRedirectResult=km}async _openPopup(e,t,r,i){var o;it((o=this.eventManagers[e._key()])===null||o===void 0?void 0:o.manager,"_initialize() not called before _openPopup()");const a=await Tc(e,t,r,xs(),i);return rg(e,a,uo())}async _openRedirect(e,t,r,i){await this._originValidation(e);const o=await Tc(e,t,r,xs(),i);return dm(o),new Promise(()=>{})}_initialize(e){const t=e._key();if(this.eventManagers[t]){const{manager:i,promise:o}=this.eventManagers[t];return i?Promise.resolve(i):(it(o,"If manager is not set, promise should be"),o)}const r=this.initAndGetManager(e);return this.eventManagers[t]={promise:r},r.catch(()=>{delete this.eventManagers[t]}),r}async initAndGetManager(e){const t=await Xm(e),r=new Mm(e);return t.register("authEvent",i=>(L(i?.authEvent,e,"invalid-auth-event"),{status:r.onEvent(i.authEvent)?"ACK":"ERROR"}),gapi.iframes.CROSS_ORIGIN_IFRAMES_FILTER),this.eventManagers[e._key()]={manager:r},this.iframes[e._key()]=t,r}_isIframeWebStorageSupported(e,t){this.iframes[e._key()].send(Cs,{type:Cs},i=>{var o;const a=(o=i?.[0])===null||o===void 0?void 0:o[Cs];a!==void 0&&t(!!a),Ne(e,"internal-error")},gapi.iframes.CROSS_ORIGIN_IFRAMES_FILTER)}_originValidation(e){const t=e._key();return this.originValidationPromises[t]||(this.originValidationPromises[t]=Bm(e)),this.originValidationPromises[t]}get _shouldInitProactively(){return Uu()||ao()||Ti()}}const ul=ug;var wc="@firebase/auth",Ac="1.7.5";/**
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
 */class lg{constructor(e){this.auth=e,this.internalListeners=new Map}getUid(){var e;return this.assertAuthConfigured(),((e=this.auth.currentUser)===null||e===void 0?void 0:e.uid)||null}async getToken(e){return this.assertAuthConfigured(),await this.auth._initializationPromise,this.auth.currentUser?{accessToken:await this.auth.currentUser.getIdToken(e)}:null}addAuthTokenListener(e){if(this.assertAuthConfigured(),this.internalListeners.has(e))return;const t=this.auth.onIdTokenChanged(r=>{e(r?.stsTokenManager.accessToken||null)});this.internalListeners.set(e,t),this.updateProactiveRefresh()}removeAuthTokenListener(e){this.assertAuthConfigured();const t=this.internalListeners.get(e);t&&(this.internalListeners.delete(e),t(),this.updateProactiveRefresh())}assertAuthConfigured(){L(this.auth._initializationPromise,"dependent-sdk-initialized-before-auth")}updateProactiveRefresh(){this.internalListeners.size>0?this.auth._startProactiveRefresh():this.auth._stopProactiveRefresh()}}/**
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
 */function hg(n){switch(n){case"Node":return"node";case"ReactNative":return"rn";case"Worker":return"webworker";case"Cordova":return"cordova";case"WebExtension":return"web-extension";default:return}}function dg(n){cn(new Nt("auth",(e,{options:t})=>{const r=e.getProvider("app").getImmediate(),i=e.getProvider("heartbeat"),o=e.getProvider("app-check-internal"),{apiKey:a,authDomain:u}=r.options;L(a&&!a.includes(":"),"invalid-api-key",{appName:r.name});const l={apiKey:a,authDomain:u,clientPlatform:n,apiHost:"identitytoolkit.googleapis.com",tokenApiHost:"securetoken.googleapis.com",apiScheme:"https",sdkClientVersion:Bu(n)},d=new Ap(r,i,o,l);return Vp(d,t),d},"PUBLIC").setInstantiationMode("EXPLICIT").setInstanceCreatedCallback((e,t,r)=>{e.getProvider("auth-internal").initialize()})),cn(new Nt("auth-internal",e=>{const t=Ge(e.getProvider("auth").getImmediate());return(r=>new lg(r))(t)},"PRIVATE").setInstantiationMode("EXPLICIT")),yt(wc,Ac,hg(n)),yt(wc,Ac,"esm2017")}/**
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
 */const fg=300,pg=mu("authIdTokenMaxAge")||fg;let Rc=null;const mg=n=>async e=>{const t=e&&await e.getIdTokenResult(),r=t&&(new Date().getTime()-Date.parse(t.issuedAtTime))/1e3;if(r&&r>pg)return;const i=t?.token;Rc!==i&&(Rc=i,await fetch(n,{method:i?"POST":"DELETE",headers:i?{Authorization:`Bearer ${i}`}:{}}))};function gg(n=yu()){const e=Ii(n,"auth");if(e.isInitialized())return e.getImmediate();const t=ju(n,{popupRedirectResolver:ul,persistence:[ol,el,co]}),r=mu("authTokenSyncURL");if(r&&typeof isSecureContext=="boolean"&&isSecureContext){const o=new URL(r,location.origin);if(location.origin===o.origin){const a=mg(o.toString());Xu(t,a,()=>a(t.currentUser)),Yu(t,u=>a(u))}}const i=fu("auth");return i&&$u(t,`http://${i}`),t}function _g(){var n,e;return(e=(n=document.getElementsByTagName("head"))===null||n===void 0?void 0:n[0])!==null&&e!==void 0?e:document}Rp({loadJS(n){return new Promise((e,t)=>{const r=document.createElement("script");r.setAttribute("src",n),r.onload=e,r.onerror=i=>{const o=Ve("internal-error");o.customData=i,t(o)},r.type="text/javascript",r.charset="UTF-8",_g().appendChild(r)})},gapiScript:"https://apis.google.com/js/api.js",recaptchaV2Script:"https://www.google.com/recaptcha/api.js",recaptchaEnterpriseScript:"https://www.google.com/recaptcha/enterprise.js?render="});dg("Browser");const Lv=Object.freeze(Object.defineProperty({__proto__:null,ActionCodeURL:Ri,AuthCredential:Ai,EmailAuthCredential:un,EmailAuthProvider:Bt,FacebookAuthProvider:Ye,GithubAuthProvider:Je,GoogleAuthProvider:Xe,OAuthCredential:$e,OAuthProvider:Xn,TwitterAuthProvider:Ze,beforeAuthStateChanged:Xu,browserLocalPersistence:el,browserPopupRedirectResolver:ul,browserSessionPersistence:co,connectAuthEmulator:$u,createUserWithEmailAndPassword:Xp,deleteUser:om,getAuth:gg,getIdTokenResult:bu,inMemoryPersistence:Us,indexedDBLocalPersistence:ol,initializeAuth:ju,onAuthStateChanged:im,onIdTokenChanged:Yu,prodErrorMap:Tu,reauthenticateWithCredential:Hp,reauthenticateWithPopup:Pm,reload:ku,sendPasswordResetEmail:Yp,setPersistence:rm,signInWithCredential:Ku,signInWithCustomToken:Qp,signInWithEmailAndPassword:Jp,signInWithPopup:Rm,signOut:sm,updatePassword:tm,updateProfile:em},Symbol.toStringTag,{value:"Module"}));var Pc=typeof globalThis<"u"?globalThis:typeof window<"u"?window:typeof global<"u"?global:typeof self<"u"?self:{};/** @license
Copyright The Closure Library Authors.
SPDX-License-Identifier: Apache-2.0
*/var Vt,ll;(function(){var n;/** @license

 Copyright The Closure Library Authors.
 SPDX-License-Identifier: Apache-2.0
*/function e(E,m){function _(){}_.prototype=m.prototype,E.D=m.prototype,E.prototype=new _,E.prototype.constructor=E,E.C=function(v,I,A){for(var g=Array(arguments.length-2),He=2;He<arguments.length;He++)g[He-2]=arguments[He];return m.prototype[I].apply(v,g)}}function t(){this.blockSize=-1}function r(){this.blockSize=-1,this.blockSize=64,this.g=Array(4),this.B=Array(this.blockSize),this.o=this.h=0,this.s()}e(r,t),r.prototype.s=function(){this.g[0]=1732584193,this.g[1]=4023233417,this.g[2]=2562383102,this.g[3]=271733878,this.o=this.h=0};function i(E,m,_){_||(_=0);var v=Array(16);if(typeof m=="string")for(var I=0;16>I;++I)v[I]=m.charCodeAt(_++)|m.charCodeAt(_++)<<8|m.charCodeAt(_++)<<16|m.charCodeAt(_++)<<24;else for(I=0;16>I;++I)v[I]=m[_++]|m[_++]<<8|m[_++]<<16|m[_++]<<24;m=E.g[0],_=E.g[1],I=E.g[2];var A=E.g[3],g=m+(A^_&(I^A))+v[0]+3614090360&4294967295;m=_+(g<<7&4294967295|g>>>25),g=A+(I^m&(_^I))+v[1]+3905402710&4294967295,A=m+(g<<12&4294967295|g>>>20),g=I+(_^A&(m^_))+v[2]+606105819&4294967295,I=A+(g<<17&4294967295|g>>>15),g=_+(m^I&(A^m))+v[3]+3250441966&4294967295,_=I+(g<<22&4294967295|g>>>10),g=m+(A^_&(I^A))+v[4]+4118548399&4294967295,m=_+(g<<7&4294967295|g>>>25),g=A+(I^m&(_^I))+v[5]+1200080426&4294967295,A=m+(g<<12&4294967295|g>>>20),g=I+(_^A&(m^_))+v[6]+2821735955&4294967295,I=A+(g<<17&4294967295|g>>>15),g=_+(m^I&(A^m))+v[7]+4249261313&4294967295,_=I+(g<<22&4294967295|g>>>10),g=m+(A^_&(I^A))+v[8]+1770035416&4294967295,m=_+(g<<7&4294967295|g>>>25),g=A+(I^m&(_^I))+v[9]+2336552879&4294967295,A=m+(g<<12&4294967295|g>>>20),g=I+(_^A&(m^_))+v[10]+4294925233&4294967295,I=A+(g<<17&4294967295|g>>>15),g=_+(m^I&(A^m))+v[11]+2304563134&4294967295,_=I+(g<<22&4294967295|g>>>10),g=m+(A^_&(I^A))+v[12]+1804603682&4294967295,m=_+(g<<7&4294967295|g>>>25),g=A+(I^m&(_^I))+v[13]+4254626195&4294967295,A=m+(g<<12&4294967295|g>>>20),g=I+(_^A&(m^_))+v[14]+2792965006&4294967295,I=A+(g<<17&4294967295|g>>>15),g=_+(m^I&(A^m))+v[15]+1236535329&4294967295,_=I+(g<<22&4294967295|g>>>10),g=m+(I^A&(_^I))+v[1]+4129170786&4294967295,m=_+(g<<5&4294967295|g>>>27),g=A+(_^I&(m^_))+v[6]+3225465664&4294967295,A=m+(g<<9&4294967295|g>>>23),g=I+(m^_&(A^m))+v[11]+643717713&4294967295,I=A+(g<<14&4294967295|g>>>18),g=_+(A^m&(I^A))+v[0]+3921069994&4294967295,_=I+(g<<20&4294967295|g>>>12),g=m+(I^A&(_^I))+v[5]+3593408605&4294967295,m=_+(g<<5&4294967295|g>>>27),g=A+(_^I&(m^_))+v[10]+38016083&4294967295,A=m+(g<<9&4294967295|g>>>23),g=I+(m^_&(A^m))+v[15]+3634488961&4294967295,I=A+(g<<14&4294967295|g>>>18),g=_+(A^m&(I^A))+v[4]+3889429448&4294967295,_=I+(g<<20&4294967295|g>>>12),g=m+(I^A&(_^I))+v[9]+568446438&4294967295,m=_+(g<<5&4294967295|g>>>27),g=A+(_^I&(m^_))+v[14]+3275163606&4294967295,A=m+(g<<9&4294967295|g>>>23),g=I+(m^_&(A^m))+v[3]+4107603335&4294967295,I=A+(g<<14&4294967295|g>>>18),g=_+(A^m&(I^A))+v[8]+1163531501&4294967295,_=I+(g<<20&4294967295|g>>>12),g=m+(I^A&(_^I))+v[13]+2850285829&4294967295,m=_+(g<<5&4294967295|g>>>27),g=A+(_^I&(m^_))+v[2]+4243563512&4294967295,A=m+(g<<9&4294967295|g>>>23),g=I+(m^_&(A^m))+v[7]+1735328473&4294967295,I=A+(g<<14&4294967295|g>>>18),g=_+(A^m&(I^A))+v[12]+2368359562&4294967295,_=I+(g<<20&4294967295|g>>>12),g=m+(_^I^A)+v[5]+4294588738&4294967295,m=_+(g<<4&4294967295|g>>>28),g=A+(m^_^I)+v[8]+2272392833&4294967295,A=m+(g<<11&4294967295|g>>>21),g=I+(A^m^_)+v[11]+1839030562&4294967295,I=A+(g<<16&4294967295|g>>>16),g=_+(I^A^m)+v[14]+4259657740&4294967295,_=I+(g<<23&4294967295|g>>>9),g=m+(_^I^A)+v[1]+2763975236&4294967295,m=_+(g<<4&4294967295|g>>>28),g=A+(m^_^I)+v[4]+1272893353&4294967295,A=m+(g<<11&4294967295|g>>>21),g=I+(A^m^_)+v[7]+4139469664&4294967295,I=A+(g<<16&4294967295|g>>>16),g=_+(I^A^m)+v[10]+3200236656&4294967295,_=I+(g<<23&4294967295|g>>>9),g=m+(_^I^A)+v[13]+681279174&4294967295,m=_+(g<<4&4294967295|g>>>28),g=A+(m^_^I)+v[0]+3936430074&4294967295,A=m+(g<<11&4294967295|g>>>21),g=I+(A^m^_)+v[3]+3572445317&4294967295,I=A+(g<<16&4294967295|g>>>16),g=_+(I^A^m)+v[6]+76029189&4294967295,_=I+(g<<23&4294967295|g>>>9),g=m+(_^I^A)+v[9]+3654602809&4294967295,m=_+(g<<4&4294967295|g>>>28),g=A+(m^_^I)+v[12]+3873151461&4294967295,A=m+(g<<11&4294967295|g>>>21),g=I+(A^m^_)+v[15]+530742520&4294967295,I=A+(g<<16&4294967295|g>>>16),g=_+(I^A^m)+v[2]+3299628645&4294967295,_=I+(g<<23&4294967295|g>>>9),g=m+(I^(_|~A))+v[0]+4096336452&4294967295,m=_+(g<<6&4294967295|g>>>26),g=A+(_^(m|~I))+v[7]+1126891415&4294967295,A=m+(g<<10&4294967295|g>>>22),g=I+(m^(A|~_))+v[14]+2878612391&4294967295,I=A+(g<<15&4294967295|g>>>17),g=_+(A^(I|~m))+v[5]+4237533241&4294967295,_=I+(g<<21&4294967295|g>>>11),g=m+(I^(_|~A))+v[12]+1700485571&4294967295,m=_+(g<<6&4294967295|g>>>26),g=A+(_^(m|~I))+v[3]+2399980690&4294967295,A=m+(g<<10&4294967295|g>>>22),g=I+(m^(A|~_))+v[10]+4293915773&4294967295,I=A+(g<<15&4294967295|g>>>17),g=_+(A^(I|~m))+v[1]+2240044497&4294967295,_=I+(g<<21&4294967295|g>>>11),g=m+(I^(_|~A))+v[8]+1873313359&4294967295,m=_+(g<<6&4294967295|g>>>26),g=A+(_^(m|~I))+v[15]+4264355552&4294967295,A=m+(g<<10&4294967295|g>>>22),g=I+(m^(A|~_))+v[6]+2734768916&4294967295,I=A+(g<<15&4294967295|g>>>17),g=_+(A^(I|~m))+v[13]+1309151649&4294967295,_=I+(g<<21&4294967295|g>>>11),g=m+(I^(_|~A))+v[4]+4149444226&4294967295,m=_+(g<<6&4294967295|g>>>26),g=A+(_^(m|~I))+v[11]+3174756917&4294967295,A=m+(g<<10&4294967295|g>>>22),g=I+(m^(A|~_))+v[2]+718787259&4294967295,I=A+(g<<15&4294967295|g>>>17),g=_+(A^(I|~m))+v[9]+3951481745&4294967295,E.g[0]=E.g[0]+m&4294967295,E.g[1]=E.g[1]+(I+(g<<21&4294967295|g>>>11))&4294967295,E.g[2]=E.g[2]+I&4294967295,E.g[3]=E.g[3]+A&4294967295}r.prototype.u=function(E,m){m===void 0&&(m=E.length);for(var _=m-this.blockSize,v=this.B,I=this.h,A=0;A<m;){if(I==0)for(;A<=_;)i(this,E,A),A+=this.blockSize;if(typeof E=="string"){for(;A<m;)if(v[I++]=E.charCodeAt(A++),I==this.blockSize){i(this,v),I=0;break}}else for(;A<m;)if(v[I++]=E[A++],I==this.blockSize){i(this,v),I=0;break}}this.h=I,this.o+=m},r.prototype.v=function(){var E=Array((56>this.h?this.blockSize:2*this.blockSize)-this.h);E[0]=128;for(var m=1;m<E.length-8;++m)E[m]=0;var _=8*this.o;for(m=E.length-8;m<E.length;++m)E[m]=_&255,_/=256;for(this.u(E),E=Array(16),m=_=0;4>m;++m)for(var v=0;32>v;v+=8)E[_++]=this.g[m]>>>v&255;return E};function o(E,m){var _=u;return Object.prototype.hasOwnProperty.call(_,E)?_[E]:_[E]=m(E)}function a(E,m){this.h=m;for(var _=[],v=!0,I=E.length-1;0<=I;I--){var A=E[I]|0;v&&A==m||(_[I]=A,v=!1)}this.g=_}var u={};function l(E){return-128<=E&&128>E?o(E,function(m){return new a([m|0],0>m?-1:0)}):new a([E|0],0>E?-1:0)}function d(E){if(isNaN(E)||!isFinite(E))return y;if(0>E)return k(d(-E));for(var m=[],_=1,v=0;E>=_;v++)m[v]=E/_|0,_*=4294967296;return new a(m,0)}function p(E,m){if(E.length==0)throw Error("number format error: empty string");if(m=m||10,2>m||36<m)throw Error("radix out of range: "+m);if(E.charAt(0)=="-")return k(p(E.substring(1),m));if(0<=E.indexOf("-"))throw Error('number format error: interior "-" character');for(var _=d(Math.pow(m,8)),v=y,I=0;I<E.length;I+=8){var A=Math.min(8,E.length-I),g=parseInt(E.substring(I,I+A),m);8>A?(A=d(Math.pow(m,A)),v=v.j(A).add(d(g))):(v=v.j(_),v=v.add(d(g)))}return v}var y=l(0),T=l(1),S=l(16777216);n=a.prototype,n.m=function(){if(N(this))return-k(this).m();for(var E=0,m=1,_=0;_<this.g.length;_++){var v=this.i(_);E+=(0<=v?v:4294967296+v)*m,m*=4294967296}return E},n.toString=function(E){if(E=E||10,2>E||36<E)throw Error("radix out of range: "+E);if(V(this))return"0";if(N(this))return"-"+k(this).toString(E);for(var m=d(Math.pow(E,6)),_=this,v="";;){var I=te(_,m).g;_=B(_,I.j(m));var A=((0<_.g.length?_.g[0]:_.h)>>>0).toString(E);if(_=I,V(_))return A+v;for(;6>A.length;)A="0"+A;v=A+v}},n.i=function(E){return 0>E?0:E<this.g.length?this.g[E]:this.h};function V(E){if(E.h!=0)return!1;for(var m=0;m<E.g.length;m++)if(E.g[m]!=0)return!1;return!0}function N(E){return E.h==-1}n.l=function(E){return E=B(this,E),N(E)?-1:V(E)?0:1};function k(E){for(var m=E.g.length,_=[],v=0;v<m;v++)_[v]=~E.g[v];return new a(_,~E.h).add(T)}n.abs=function(){return N(this)?k(this):this},n.add=function(E){for(var m=Math.max(this.g.length,E.g.length),_=[],v=0,I=0;I<=m;I++){var A=v+(this.i(I)&65535)+(E.i(I)&65535),g=(A>>>16)+(this.i(I)>>>16)+(E.i(I)>>>16);v=g>>>16,A&=65535,g&=65535,_[I]=g<<16|A}return new a(_,_[_.length-1]&-2147483648?-1:0)};function B(E,m){return E.add(k(m))}n.j=function(E){if(V(this)||V(E))return y;if(N(this))return N(E)?k(this).j(k(E)):k(k(this).j(E));if(N(E))return k(this.j(k(E)));if(0>this.l(S)&&0>E.l(S))return d(this.m()*E.m());for(var m=this.g.length+E.g.length,_=[],v=0;v<2*m;v++)_[v]=0;for(v=0;v<this.g.length;v++)for(var I=0;I<E.g.length;I++){var A=this.i(v)>>>16,g=this.i(v)&65535,He=E.i(I)>>>16,Pn=E.i(I)&65535;_[2*v+2*I]+=g*Pn,W(_,2*v+2*I),_[2*v+2*I+1]+=A*Pn,W(_,2*v+2*I+1),_[2*v+2*I+1]+=g*He,W(_,2*v+2*I+1),_[2*v+2*I+2]+=A*He,W(_,2*v+2*I+2)}for(v=0;v<m;v++)_[v]=_[2*v+1]<<16|_[2*v];for(v=m;v<2*m;v++)_[v]=0;return new a(_,0)};function W(E,m){for(;(E[m]&65535)!=E[m];)E[m+1]+=E[m]>>>16,E[m]&=65535,m++}function H(E,m){this.g=E,this.h=m}function te(E,m){if(V(m))throw Error("division by zero");if(V(E))return new H(y,y);if(N(E))return m=te(k(E),m),new H(k(m.g),k(m.h));if(N(m))return m=te(E,k(m)),new H(k(m.g),m.h);if(30<E.g.length){if(N(E)||N(m))throw Error("slowDivide_ only works with positive integers.");for(var _=T,v=m;0>=v.l(E);)_=De(_),v=De(v);var I=ne(_,1),A=ne(v,1);for(v=ne(v,2),_=ne(_,2);!V(v);){var g=A.add(v);0>=g.l(E)&&(I=I.add(_),A=g),v=ne(v,1),_=ne(_,1)}return m=B(E,I.j(m)),new H(I,m)}for(I=y;0<=E.l(m);){for(_=Math.max(1,Math.floor(E.m()/m.m())),v=Math.ceil(Math.log(_)/Math.LN2),v=48>=v?1:Math.pow(2,v-48),A=d(_),g=A.j(m);N(g)||0<g.l(E);)_-=v,A=d(_),g=A.j(m);V(A)&&(A=T),I=I.add(A),E=B(E,g)}return new H(I,E)}n.A=function(E){return te(this,E).h},n.and=function(E){for(var m=Math.max(this.g.length,E.g.length),_=[],v=0;v<m;v++)_[v]=this.i(v)&E.i(v);return new a(_,this.h&E.h)},n.or=function(E){for(var m=Math.max(this.g.length,E.g.length),_=[],v=0;v<m;v++)_[v]=this.i(v)|E.i(v);return new a(_,this.h|E.h)},n.xor=function(E){for(var m=Math.max(this.g.length,E.g.length),_=[],v=0;v<m;v++)_[v]=this.i(v)^E.i(v);return new a(_,this.h^E.h)};function De(E){for(var m=E.g.length+1,_=[],v=0;v<m;v++)_[v]=E.i(v)<<1|E.i(v-1)>>>31;return new a(_,E.h)}function ne(E,m){var _=m>>5;m%=32;for(var v=E.g.length-_,I=[],A=0;A<v;A++)I[A]=0<m?E.i(A+_)>>>m|E.i(A+_+1)<<32-m:E.i(A+_);return new a(I,E.h)}r.prototype.digest=r.prototype.v,r.prototype.reset=r.prototype.s,r.prototype.update=r.prototype.u,ll=r,a.prototype.add=a.prototype.add,a.prototype.multiply=a.prototype.j,a.prototype.modulo=a.prototype.A,a.prototype.compare=a.prototype.l,a.prototype.toNumber=a.prototype.m,a.prototype.toString=a.prototype.toString,a.prototype.getBits=a.prototype.i,a.fromNumber=d,a.fromString=p,Vt=a}).apply(typeof Pc<"u"?Pc:typeof self<"u"?self:typeof window<"u"?window:{});var Hr=typeof globalThis<"u"?globalThis:typeof window<"u"?window:typeof global<"u"?global:typeof self<"u"?self:{};/** @license
Copyright The Closure Library Authors.
SPDX-License-Identifier: Apache-2.0
*/var hl,dl,Hn,fl,ti,qs,pl,ml,gl;(function(){var n,e=typeof Object.defineProperties=="function"?Object.defineProperty:function(s,c,h){return s==Array.prototype||s==Object.prototype||(s[c]=h.value),s};function t(s){s=[typeof globalThis=="object"&&globalThis,s,typeof window=="object"&&window,typeof self=="object"&&self,typeof Hr=="object"&&Hr];for(var c=0;c<s.length;++c){var h=s[c];if(h&&h.Math==Math)return h}throw Error("Cannot find global object")}var r=t(this);function i(s,c){if(c)e:{var h=r;s=s.split(".");for(var f=0;f<s.length-1;f++){var w=s[f];if(!(w in h))break e;h=h[w]}s=s[s.length-1],f=h[s],c=c(f),c!=f&&c!=null&&e(h,s,{configurable:!0,writable:!0,value:c})}}function o(s,c){s instanceof String&&(s+="");var h=0,f=!1,w={next:function(){if(!f&&h<s.length){var R=h++;return{value:c(R,s[R]),done:!1}}return f=!0,{done:!0,value:void 0}}};return w[Symbol.iterator]=function(){return w},w}i("Array.prototype.values",function(s){return s||function(){return o(this,function(c,h){return h})}});/** @license

 Copyright The Closure Library Authors.
 SPDX-License-Identifier: Apache-2.0
*/var a=a||{},u=this||self;function l(s){var c=typeof s;return c=c!="object"?c:s?Array.isArray(s)?"array":c:"null",c=="array"||c=="object"&&typeof s.length=="number"}function d(s){var c=typeof s;return c=="object"&&s!=null||c=="function"}function p(s,c,h){return s.call.apply(s.bind,arguments)}function y(s,c,h){if(!s)throw Error();if(2<arguments.length){var f=Array.prototype.slice.call(arguments,2);return function(){var w=Array.prototype.slice.call(arguments);return Array.prototype.unshift.apply(w,f),s.apply(c,w)}}return function(){return s.apply(c,arguments)}}function T(s,c,h){return T=Function.prototype.bind&&Function.prototype.bind.toString().indexOf("native code")!=-1?p:y,T.apply(null,arguments)}function S(s,c){var h=Array.prototype.slice.call(arguments,1);return function(){var f=h.slice();return f.push.apply(f,arguments),s.apply(this,f)}}function V(s,c){function h(){}h.prototype=c.prototype,s.aa=c.prototype,s.prototype=new h,s.prototype.constructor=s,s.Qb=function(f,w,R){for(var D=Array(arguments.length-2),X=2;X<arguments.length;X++)D[X-2]=arguments[X];return c.prototype[w].apply(f,D)}}function N(s){const c=s.length;if(0<c){const h=Array(c);for(let f=0;f<c;f++)h[f]=s[f];return h}return[]}function k(s,c){for(let h=1;h<arguments.length;h++){const f=arguments[h];if(l(f)){const w=s.length||0,R=f.length||0;s.length=w+R;for(let D=0;D<R;D++)s[w+D]=f[D]}else s.push(f)}}class B{constructor(c,h){this.i=c,this.j=h,this.h=0,this.g=null}get(){let c;return 0<this.h?(this.h--,c=this.g,this.g=c.next,c.next=null):c=this.i(),c}}function W(s){return/^[\s\xa0]*$/.test(s)}function H(){var s=u.navigator;return s&&(s=s.userAgent)?s:""}function te(s){return te[" "](s),s}te[" "]=function(){};var De=H().indexOf("Gecko")!=-1&&!(H().toLowerCase().indexOf("webkit")!=-1&&H().indexOf("Edge")==-1)&&!(H().indexOf("Trident")!=-1||H().indexOf("MSIE")!=-1)&&H().indexOf("Edge")==-1;function ne(s,c,h){for(const f in s)c.call(h,s[f],f,s)}function E(s,c){for(const h in s)c.call(void 0,s[h],h,s)}function m(s){const c={};for(const h in s)c[h]=s[h];return c}const _="constructor hasOwnProperty isPrototypeOf propertyIsEnumerable toLocaleString toString valueOf".split(" ");function v(s,c){let h,f;for(let w=1;w<arguments.length;w++){f=arguments[w];for(h in f)s[h]=f[h];for(let R=0;R<_.length;R++)h=_[R],Object.prototype.hasOwnProperty.call(f,h)&&(s[h]=f[h])}}function I(s){var c=1;s=s.split(":");const h=[];for(;0<c&&s.length;)h.push(s.shift()),c--;return s.length&&h.push(s.join(":")),h}function A(s){u.setTimeout(()=>{throw s},0)}function g(){var s=Ji;let c=null;return s.g&&(c=s.g,s.g=s.g.next,s.g||(s.h=null),c.next=null),c}class He{constructor(){this.h=this.g=null}add(c,h){const f=Pn.get();f.set(c,h),this.h?this.h.next=f:this.g=f,this.h=f}}var Pn=new B(()=>new Mh,s=>s.reset());class Mh{constructor(){this.next=this.g=this.h=null}set(c,h){this.h=c,this.g=h,this.next=null}reset(){this.next=this.g=this.h=null}}let Sn,Cn=!1,Ji=new He,Jo=()=>{const s=u.Promise.resolve(void 0);Sn=()=>{s.then(Lh)}};var Lh=()=>{for(var s;s=g();){try{s.h.call(s.g)}catch(h){A(h)}var c=Pn;c.j(s),100>c.h&&(c.h++,s.next=c.g,c.g=s)}Cn=!1};function ct(){this.s=this.s,this.C=this.C}ct.prototype.s=!1,ct.prototype.ma=function(){this.s||(this.s=!0,this.N())},ct.prototype.N=function(){if(this.C)for(;this.C.length;)this.C.shift()()};function ye(s,c){this.type=s,this.g=this.target=c,this.defaultPrevented=!1}ye.prototype.h=function(){this.defaultPrevented=!0};var xh=(function(){if(!u.addEventListener||!Object.defineProperty)return!1;var s=!1,c=Object.defineProperty({},"passive",{get:function(){s=!0}});try{const h=()=>{};u.addEventListener("test",h,c),u.removeEventListener("test",h,c)}catch{}return s})();function bn(s,c){if(ye.call(this,s?s.type:""),this.relatedTarget=this.g=this.target=null,this.button=this.screenY=this.screenX=this.clientY=this.clientX=0,this.key="",this.metaKey=this.shiftKey=this.altKey=this.ctrlKey=!1,this.state=null,this.pointerId=0,this.pointerType="",this.i=null,s){var h=this.type=s.type,f=s.changedTouches&&s.changedTouches.length?s.changedTouches[0]:null;if(this.target=s.target||s.srcElement,this.g=c,c=s.relatedTarget){if(De){e:{try{te(c.nodeName);var w=!0;break e}catch{}w=!1}w||(c=null)}}else h=="mouseover"?c=s.fromElement:h=="mouseout"&&(c=s.toElement);this.relatedTarget=c,f?(this.clientX=f.clientX!==void 0?f.clientX:f.pageX,this.clientY=f.clientY!==void 0?f.clientY:f.pageY,this.screenX=f.screenX||0,this.screenY=f.screenY||0):(this.clientX=s.clientX!==void 0?s.clientX:s.pageX,this.clientY=s.clientY!==void 0?s.clientY:s.pageY,this.screenX=s.screenX||0,this.screenY=s.screenY||0),this.button=s.button,this.key=s.key||"",this.ctrlKey=s.ctrlKey,this.altKey=s.altKey,this.shiftKey=s.shiftKey,this.metaKey=s.metaKey,this.pointerId=s.pointerId||0,this.pointerType=typeof s.pointerType=="string"?s.pointerType:Fh[s.pointerType]||"",this.state=s.state,this.i=s,s.defaultPrevented&&bn.aa.h.call(this)}}V(bn,ye);var Fh={2:"touch",3:"pen",4:"mouse"};bn.prototype.h=function(){bn.aa.h.call(this);var s=this.i;s.preventDefault?s.preventDefault():s.returnValue=!1};var Cr="closure_listenable_"+(1e6*Math.random()|0),Uh=0;function Bh(s,c,h,f,w){this.listener=s,this.proxy=null,this.src=c,this.type=h,this.capture=!!f,this.ha=w,this.key=++Uh,this.da=this.fa=!1}function br(s){s.da=!0,s.listener=null,s.proxy=null,s.src=null,s.ha=null}function kr(s){this.src=s,this.g={},this.h=0}kr.prototype.add=function(s,c,h,f,w){var R=s.toString();s=this.g[R],s||(s=this.g[R]=[],this.h++);var D=es(s,c,f,w);return-1<D?(c=s[D],h||(c.fa=!1)):(c=new Bh(c,this.src,R,!!f,w),c.fa=h,s.push(c)),c};function Zi(s,c){var h=c.type;if(h in s.g){var f=s.g[h],w=Array.prototype.indexOf.call(f,c,void 0),R;(R=0<=w)&&Array.prototype.splice.call(f,w,1),R&&(br(c),s.g[h].length==0&&(delete s.g[h],s.h--))}}function es(s,c,h,f){for(var w=0;w<s.length;++w){var R=s[w];if(!R.da&&R.listener==c&&R.capture==!!h&&R.ha==f)return w}return-1}var ts="closure_lm_"+(1e6*Math.random()|0),ns={};function Zo(s,c,h,f,w){if(Array.isArray(c)){for(var R=0;R<c.length;R++)Zo(s,c[R],h,f,w);return null}return h=na(h),s&&s[Cr]?s.K(c,h,d(f)?!!f.capture:!1,w):qh(s,c,h,!1,f,w)}function qh(s,c,h,f,w,R){if(!c)throw Error("Invalid event type");var D=d(w)?!!w.capture:!!w,X=is(s);if(X||(s[ts]=X=new kr(s)),h=X.add(c,h,f,D,R),h.proxy)return h;if(f=jh(),h.proxy=f,f.src=s,f.listener=h,s.addEventListener)xh||(w=D),w===void 0&&(w=!1),s.addEventListener(c.toString(),f,w);else if(s.attachEvent)s.attachEvent(ta(c.toString()),f);else if(s.addListener&&s.removeListener)s.addListener(f);else throw Error("addEventListener and attachEvent are unavailable.");return h}function jh(){function s(h){return c.call(s.src,s.listener,h)}const c=$h;return s}function ea(s,c,h,f,w){if(Array.isArray(c))for(var R=0;R<c.length;R++)ea(s,c[R],h,f,w);else f=d(f)?!!f.capture:!!f,h=na(h),s&&s[Cr]?(s=s.i,c=String(c).toString(),c in s.g&&(R=s.g[c],h=es(R,h,f,w),-1<h&&(br(R[h]),Array.prototype.splice.call(R,h,1),R.length==0&&(delete s.g[c],s.h--)))):s&&(s=is(s))&&(c=s.g[c.toString()],s=-1,c&&(s=es(c,h,f,w)),(h=-1<s?c[s]:null)&&rs(h))}function rs(s){if(typeof s!="number"&&s&&!s.da){var c=s.src;if(c&&c[Cr])Zi(c.i,s);else{var h=s.type,f=s.proxy;c.removeEventListener?c.removeEventListener(h,f,s.capture):c.detachEvent?c.detachEvent(ta(h),f):c.addListener&&c.removeListener&&c.removeListener(f),(h=is(c))?(Zi(h,s),h.h==0&&(h.src=null,c[ts]=null)):br(s)}}}function ta(s){return s in ns?ns[s]:ns[s]="on"+s}function $h(s,c){if(s.da)s=!0;else{c=new bn(c,this);var h=s.listener,f=s.ha||s.src;s.fa&&rs(s),s=h.call(f,c)}return s}function is(s){return s=s[ts],s instanceof kr?s:null}var ss="__closure_events_fn_"+(1e9*Math.random()>>>0);function na(s){return typeof s=="function"?s:(s[ss]||(s[ss]=function(c){return s.handleEvent(c)}),s[ss])}function ve(){ct.call(this),this.i=new kr(this),this.M=this,this.F=null}V(ve,ct),ve.prototype[Cr]=!0,ve.prototype.removeEventListener=function(s,c,h,f){ea(this,s,c,h,f)};function Ae(s,c){var h,f=s.F;if(f)for(h=[];f;f=f.F)h.push(f);if(s=s.M,f=c.type||c,typeof c=="string")c=new ye(c,s);else if(c instanceof ye)c.target=c.target||s;else{var w=c;c=new ye(f,s),v(c,w)}if(w=!0,h)for(var R=h.length-1;0<=R;R--){var D=c.g=h[R];w=Dr(D,f,!0,c)&&w}if(D=c.g=s,w=Dr(D,f,!0,c)&&w,w=Dr(D,f,!1,c)&&w,h)for(R=0;R<h.length;R++)D=c.g=h[R],w=Dr(D,f,!1,c)&&w}ve.prototype.N=function(){if(ve.aa.N.call(this),this.i){var s=this.i,c;for(c in s.g){for(var h=s.g[c],f=0;f<h.length;f++)br(h[f]);delete s.g[c],s.h--}}this.F=null},ve.prototype.K=function(s,c,h,f){return this.i.add(String(s),c,!1,h,f)},ve.prototype.L=function(s,c,h,f){return this.i.add(String(s),c,!0,h,f)};function Dr(s,c,h,f){if(c=s.i.g[String(c)],!c)return!0;c=c.concat();for(var w=!0,R=0;R<c.length;++R){var D=c[R];if(D&&!D.da&&D.capture==h){var X=D.listener,de=D.ha||D.src;D.fa&&Zi(s.i,D),w=X.call(de,f)!==!1&&w}}return w&&!f.defaultPrevented}function ra(s,c,h){if(typeof s=="function")h&&(s=T(s,h));else if(s&&typeof s.handleEvent=="function")s=T(s.handleEvent,s);else throw Error("Invalid listener argument");return 2147483647<Number(c)?-1:u.setTimeout(s,c||0)}function ia(s){s.g=ra(()=>{s.g=null,s.i&&(s.i=!1,ia(s))},s.l);const c=s.h;s.h=null,s.m.apply(null,c)}class zh extends ct{constructor(c,h){super(),this.m=c,this.l=h,this.h=null,this.i=!1,this.g=null}j(c){this.h=arguments,this.g?this.i=!0:ia(this)}N(){super.N(),this.g&&(u.clearTimeout(this.g),this.g=null,this.i=!1,this.h=null)}}function kn(s){ct.call(this),this.h=s,this.g={}}V(kn,ct);var sa=[];function oa(s){ne(s.g,function(c,h){this.g.hasOwnProperty(h)&&rs(c)},s),s.g={}}kn.prototype.N=function(){kn.aa.N.call(this),oa(this)},kn.prototype.handleEvent=function(){throw Error("EventHandler.handleEvent not implemented")};var os=u.JSON.stringify,Wh=u.JSON.parse,Gh=class{stringify(s){return u.JSON.stringify(s,void 0)}parse(s){return u.JSON.parse(s,void 0)}};function as(){}as.prototype.h=null;function aa(s){return s.h||(s.h=s.i())}function ca(){}var Dn={OPEN:"a",kb:"b",Ja:"c",wb:"d"};function cs(){ye.call(this,"d")}V(cs,ye);function us(){ye.call(this,"c")}V(us,ye);var Rt={},ua=null;function Vr(){return ua=ua||new ve}Rt.La="serverreachability";function la(s){ye.call(this,Rt.La,s)}V(la,ye);function Vn(s){const c=Vr();Ae(c,new la(c))}Rt.STAT_EVENT="statevent";function ha(s,c){ye.call(this,Rt.STAT_EVENT,s),this.stat=c}V(ha,ye);function Re(s){const c=Vr();Ae(c,new ha(c,s))}Rt.Ma="timingevent";function da(s,c){ye.call(this,Rt.Ma,s),this.size=c}V(da,ye);function Nn(s,c){if(typeof s!="function")throw Error("Fn must not be null and must be a function");return u.setTimeout(function(){s()},c)}function On(){this.g=!0}On.prototype.xa=function(){this.g=!1};function Hh(s,c,h,f,w,R){s.info(function(){if(s.g)if(R)for(var D="",X=R.split("&"),de=0;de<X.length;de++){var z=X[de].split("=");if(1<z.length){var Ee=z[0];z=z[1];var Ie=Ee.split("_");D=2<=Ie.length&&Ie[1]=="type"?D+(Ee+"="+z+"&"):D+(Ee+"=redacted&")}}else D=null;else D=R;return"XMLHTTP REQ ("+f+") [attempt "+w+"]: "+c+`
`+h+`
`+D})}function Kh(s,c,h,f,w,R,D){s.info(function(){return"XMLHTTP RESP ("+f+") [ attempt "+w+"]: "+c+`
`+h+`
`+R+" "+D})}function Kt(s,c,h,f){s.info(function(){return"XMLHTTP TEXT ("+c+"): "+Yh(s,h)+(f?" "+f:"")})}function Qh(s,c){s.info(function(){return"TIMEOUT: "+c})}On.prototype.info=function(){};function Yh(s,c){if(!s.g)return c;if(!c)return null;try{var h=JSON.parse(c);if(h){for(s=0;s<h.length;s++)if(Array.isArray(h[s])){var f=h[s];if(!(2>f.length)){var w=f[1];if(Array.isArray(w)&&!(1>w.length)){var R=w[0];if(R!="noop"&&R!="stop"&&R!="close")for(var D=1;D<w.length;D++)w[D]=""}}}}return os(h)}catch{return c}}var Nr={NO_ERROR:0,gb:1,tb:2,sb:3,nb:4,rb:5,ub:6,Ia:7,TIMEOUT:8,xb:9},fa={lb:"complete",Hb:"success",Ja:"error",Ia:"abort",zb:"ready",Ab:"readystatechange",TIMEOUT:"timeout",vb:"incrementaldata",yb:"progress",ob:"downloadprogress",Pb:"uploadprogress"},ls;function Or(){}V(Or,as),Or.prototype.g=function(){return new XMLHttpRequest},Or.prototype.i=function(){return{}},ls=new Or;function ut(s,c,h,f){this.j=s,this.i=c,this.l=h,this.R=f||1,this.U=new kn(this),this.I=45e3,this.H=null,this.o=!1,this.m=this.A=this.v=this.L=this.F=this.S=this.B=null,this.D=[],this.g=null,this.C=0,this.s=this.u=null,this.X=-1,this.J=!1,this.O=0,this.M=null,this.W=this.K=this.T=this.P=!1,this.h=new pa}function pa(){this.i=null,this.g="",this.h=!1}var ma={},hs={};function ds(s,c,h){s.L=1,s.v=Fr(Ke(c)),s.m=h,s.P=!0,ga(s,null)}function ga(s,c){s.F=Date.now(),Mr(s),s.A=Ke(s.v);var h=s.A,f=s.R;Array.isArray(f)||(f=[String(f)]),ka(h.i,"t",f),s.C=0,h=s.j.J,s.h=new pa,s.g=Ka(s.j,h?c:null,!s.m),0<s.O&&(s.M=new zh(T(s.Y,s,s.g),s.O)),c=s.U,h=s.g,f=s.ca;var w="readystatechange";Array.isArray(w)||(w&&(sa[0]=w.toString()),w=sa);for(var R=0;R<w.length;R++){var D=Zo(h,w[R],f||c.handleEvent,!1,c.h||c);if(!D)break;c.g[D.key]=D}c=s.H?m(s.H):{},s.m?(s.u||(s.u="POST"),c["Content-Type"]="application/x-www-form-urlencoded",s.g.ea(s.A,s.u,s.m,c)):(s.u="GET",s.g.ea(s.A,s.u,null,c)),Vn(),Hh(s.i,s.u,s.A,s.l,s.R,s.m)}ut.prototype.ca=function(s){s=s.target;const c=this.M;c&&Qe(s)==3?c.j():this.Y(s)},ut.prototype.Y=function(s){try{if(s==this.g)e:{const Ie=Qe(this.g);var c=this.g.Ba();const Xt=this.g.Z();if(!(3>Ie)&&(Ie!=3||this.g&&(this.h.h||this.g.oa()||xa(this.g)))){this.J||Ie!=4||c==7||(c==8||0>=Xt?Vn(3):Vn(2)),fs(this);var h=this.g.Z();this.X=h;t:if(_a(this)){var f=xa(this.g);s="";var w=f.length,R=Qe(this.g)==4;if(!this.h.i){if(typeof TextDecoder>"u"){Pt(this),Mn(this);var D="";break t}this.h.i=new u.TextDecoder}for(c=0;c<w;c++)this.h.h=!0,s+=this.h.i.decode(f[c],{stream:!(R&&c==w-1)});f.length=0,this.h.g+=s,this.C=0,D=this.h.g}else D=this.g.oa();if(this.o=h==200,Kh(this.i,this.u,this.A,this.l,this.R,Ie,h),this.o){if(this.T&&!this.K){t:{if(this.g){var X,de=this.g;if((X=de.g?de.g.getResponseHeader("X-HTTP-Initial-Response"):null)&&!W(X)){var z=X;break t}}z=null}if(h=z)Kt(this.i,this.l,h,"Initial handshake response via X-HTTP-Initial-Response"),this.K=!0,ps(this,h);else{this.o=!1,this.s=3,Re(12),Pt(this),Mn(this);break e}}if(this.P){h=!0;let Me;for(;!this.J&&this.C<D.length;)if(Me=Xh(this,D),Me==hs){Ie==4&&(this.s=4,Re(14),h=!1),Kt(this.i,this.l,null,"[Incomplete Response]");break}else if(Me==ma){this.s=4,Re(15),Kt(this.i,this.l,D,"[Invalid Chunk]"),h=!1;break}else Kt(this.i,this.l,Me,null),ps(this,Me);if(_a(this)&&this.C!=0&&(this.h.g=this.h.g.slice(this.C),this.C=0),Ie!=4||D.length!=0||this.h.h||(this.s=1,Re(16),h=!1),this.o=this.o&&h,!h)Kt(this.i,this.l,D,"[Invalid Chunked Response]"),Pt(this),Mn(this);else if(0<D.length&&!this.W){this.W=!0;var Ee=this.j;Ee.g==this&&Ee.ba&&!Ee.M&&(Ee.j.info("Great, no buffering proxy detected. Bytes received: "+D.length),Es(Ee),Ee.M=!0,Re(11))}}else Kt(this.i,this.l,D,null),ps(this,D);Ie==4&&Pt(this),this.o&&!this.J&&(Ie==4?za(this.j,this):(this.o=!1,Mr(this)))}else pd(this.g),h==400&&0<D.indexOf("Unknown SID")?(this.s=3,Re(12)):(this.s=0,Re(13)),Pt(this),Mn(this)}}}catch{}finally{}};function _a(s){return s.g?s.u=="GET"&&s.L!=2&&s.j.Ca:!1}function Xh(s,c){var h=s.C,f=c.indexOf(`
`,h);return f==-1?hs:(h=Number(c.substring(h,f)),isNaN(h)?ma:(f+=1,f+h>c.length?hs:(c=c.slice(f,f+h),s.C=f+h,c)))}ut.prototype.cancel=function(){this.J=!0,Pt(this)};function Mr(s){s.S=Date.now()+s.I,ya(s,s.I)}function ya(s,c){if(s.B!=null)throw Error("WatchDog timer not null");s.B=Nn(T(s.ba,s),c)}function fs(s){s.B&&(u.clearTimeout(s.B),s.B=null)}ut.prototype.ba=function(){this.B=null;const s=Date.now();0<=s-this.S?(Qh(this.i,this.A),this.L!=2&&(Vn(),Re(17)),Pt(this),this.s=2,Mn(this)):ya(this,this.S-s)};function Mn(s){s.j.G==0||s.J||za(s.j,s)}function Pt(s){fs(s);var c=s.M;c&&typeof c.ma=="function"&&c.ma(),s.M=null,oa(s.U),s.g&&(c=s.g,s.g=null,c.abort(),c.ma())}function ps(s,c){try{var h=s.j;if(h.G!=0&&(h.g==s||ms(h.h,s))){if(!s.K&&ms(h.h,s)&&h.G==3){try{var f=h.Da.g.parse(c)}catch{f=null}if(Array.isArray(f)&&f.length==3){var w=f;if(w[0]==0){e:if(!h.u){if(h.g)if(h.g.F+3e3<s.F)$r(h),qr(h);else break e;vs(h),Re(18)}}else h.za=w[1],0<h.za-h.T&&37500>w[2]&&h.F&&h.v==0&&!h.C&&(h.C=Nn(T(h.Za,h),6e3));if(1>=Ia(h.h)&&h.ca){try{h.ca()}catch{}h.ca=void 0}}else Ct(h,11)}else if((s.K||h.g==s)&&$r(h),!W(c))for(w=h.Da.g.parse(c),c=0;c<w.length;c++){let z=w[c];if(h.T=z[0],z=z[1],h.G==2)if(z[0]=="c"){h.K=z[1],h.ia=z[2];const Ee=z[3];Ee!=null&&(h.la=Ee,h.j.info("VER="+h.la));const Ie=z[4];Ie!=null&&(h.Aa=Ie,h.j.info("SVER="+h.Aa));const Xt=z[5];Xt!=null&&typeof Xt=="number"&&0<Xt&&(f=1.5*Xt,h.L=f,h.j.info("backChannelRequestTimeoutMs_="+f)),f=h;const Me=s.g;if(Me){const Wr=Me.g?Me.g.getResponseHeader("X-Client-Wire-Protocol"):null;if(Wr){var R=f.h;R.g||Wr.indexOf("spdy")==-1&&Wr.indexOf("quic")==-1&&Wr.indexOf("h2")==-1||(R.j=R.l,R.g=new Set,R.h&&(gs(R,R.h),R.h=null))}if(f.D){const Is=Me.g?Me.g.getResponseHeader("X-HTTP-Session-Id"):null;Is&&(f.ya=Is,J(f.I,f.D,Is))}}h.G=3,h.l&&h.l.ua(),h.ba&&(h.R=Date.now()-s.F,h.j.info("Handshake RTT: "+h.R+"ms")),f=h;var D=s;if(f.qa=Ha(f,f.J?f.ia:null,f.W),D.K){Ta(f.h,D);var X=D,de=f.L;de&&(X.I=de),X.B&&(fs(X),Mr(X)),f.g=D}else ja(f);0<h.i.length&&jr(h)}else z[0]!="stop"&&z[0]!="close"||Ct(h,7);else h.G==3&&(z[0]=="stop"||z[0]=="close"?z[0]=="stop"?Ct(h,7):ys(h):z[0]!="noop"&&h.l&&h.l.ta(z),h.v=0)}}Vn(4)}catch{}}var Jh=class{constructor(s,c){this.g=s,this.map=c}};function va(s){this.l=s||10,u.PerformanceNavigationTiming?(s=u.performance.getEntriesByType("navigation"),s=0<s.length&&(s[0].nextHopProtocol=="hq"||s[0].nextHopProtocol=="h2")):s=!!(u.chrome&&u.chrome.loadTimes&&u.chrome.loadTimes()&&u.chrome.loadTimes().wasFetchedViaSpdy),this.j=s?this.l:1,this.g=null,1<this.j&&(this.g=new Set),this.h=null,this.i=[]}function Ea(s){return s.h?!0:s.g?s.g.size>=s.j:!1}function Ia(s){return s.h?1:s.g?s.g.size:0}function ms(s,c){return s.h?s.h==c:s.g?s.g.has(c):!1}function gs(s,c){s.g?s.g.add(c):s.h=c}function Ta(s,c){s.h&&s.h==c?s.h=null:s.g&&s.g.has(c)&&s.g.delete(c)}va.prototype.cancel=function(){if(this.i=wa(this),this.h)this.h.cancel(),this.h=null;else if(this.g&&this.g.size!==0){for(const s of this.g.values())s.cancel();this.g.clear()}};function wa(s){if(s.h!=null)return s.i.concat(s.h.D);if(s.g!=null&&s.g.size!==0){let c=s.i;for(const h of s.g.values())c=c.concat(h.D);return c}return N(s.i)}function Zh(s){if(s.V&&typeof s.V=="function")return s.V();if(typeof Map<"u"&&s instanceof Map||typeof Set<"u"&&s instanceof Set)return Array.from(s.values());if(typeof s=="string")return s.split("");if(l(s)){for(var c=[],h=s.length,f=0;f<h;f++)c.push(s[f]);return c}c=[],h=0;for(f in s)c[h++]=s[f];return c}function ed(s){if(s.na&&typeof s.na=="function")return s.na();if(!s.V||typeof s.V!="function"){if(typeof Map<"u"&&s instanceof Map)return Array.from(s.keys());if(!(typeof Set<"u"&&s instanceof Set)){if(l(s)||typeof s=="string"){var c=[];s=s.length;for(var h=0;h<s;h++)c.push(h);return c}c=[],h=0;for(const f in s)c[h++]=f;return c}}}function Aa(s,c){if(s.forEach&&typeof s.forEach=="function")s.forEach(c,void 0);else if(l(s)||typeof s=="string")Array.prototype.forEach.call(s,c,void 0);else for(var h=ed(s),f=Zh(s),w=f.length,R=0;R<w;R++)c.call(void 0,f[R],h&&h[R],s)}var Ra=RegExp("^(?:([^:/?#.]+):)?(?://(?:([^\\\\/?#]*)@)?([^\\\\/?#]*?)(?::([0-9]+))?(?=[\\\\/?#]|$))?([^?#]+)?(?:\\?([^#]*))?(?:#([\\s\\S]*))?$");function td(s,c){if(s){s=s.split("&");for(var h=0;h<s.length;h++){var f=s[h].indexOf("="),w=null;if(0<=f){var R=s[h].substring(0,f);w=s[h].substring(f+1)}else R=s[h];c(R,w?decodeURIComponent(w.replace(/\+/g," ")):"")}}}function St(s){if(this.g=this.o=this.j="",this.s=null,this.m=this.l="",this.h=!1,s instanceof St){this.h=s.h,Lr(this,s.j),this.o=s.o,this.g=s.g,xr(this,s.s),this.l=s.l;var c=s.i,h=new Fn;h.i=c.i,c.g&&(h.g=new Map(c.g),h.h=c.h),Pa(this,h),this.m=s.m}else s&&(c=String(s).match(Ra))?(this.h=!1,Lr(this,c[1]||"",!0),this.o=Ln(c[2]||""),this.g=Ln(c[3]||"",!0),xr(this,c[4]),this.l=Ln(c[5]||"",!0),Pa(this,c[6]||"",!0),this.m=Ln(c[7]||"")):(this.h=!1,this.i=new Fn(null,this.h))}St.prototype.toString=function(){var s=[],c=this.j;c&&s.push(xn(c,Sa,!0),":");var h=this.g;return(h||c=="file")&&(s.push("//"),(c=this.o)&&s.push(xn(c,Sa,!0),"@"),s.push(encodeURIComponent(String(h)).replace(/%25([0-9a-fA-F]{2})/g,"%$1")),h=this.s,h!=null&&s.push(":",String(h))),(h=this.l)&&(this.g&&h.charAt(0)!="/"&&s.push("/"),s.push(xn(h,h.charAt(0)=="/"?id:rd,!0))),(h=this.i.toString())&&s.push("?",h),(h=this.m)&&s.push("#",xn(h,od)),s.join("")};function Ke(s){return new St(s)}function Lr(s,c,h){s.j=h?Ln(c,!0):c,s.j&&(s.j=s.j.replace(/:$/,""))}function xr(s,c){if(c){if(c=Number(c),isNaN(c)||0>c)throw Error("Bad port number "+c);s.s=c}else s.s=null}function Pa(s,c,h){c instanceof Fn?(s.i=c,ad(s.i,s.h)):(h||(c=xn(c,sd)),s.i=new Fn(c,s.h))}function J(s,c,h){s.i.set(c,h)}function Fr(s){return J(s,"zx",Math.floor(2147483648*Math.random()).toString(36)+Math.abs(Math.floor(2147483648*Math.random())^Date.now()).toString(36)),s}function Ln(s,c){return s?c?decodeURI(s.replace(/%25/g,"%2525")):decodeURIComponent(s):""}function xn(s,c,h){return typeof s=="string"?(s=encodeURI(s).replace(c,nd),h&&(s=s.replace(/%25([0-9a-fA-F]{2})/g,"%$1")),s):null}function nd(s){return s=s.charCodeAt(0),"%"+(s>>4&15).toString(16)+(s&15).toString(16)}var Sa=/[#\/\?@]/g,rd=/[#\?:]/g,id=/[#\?]/g,sd=/[#\?@]/g,od=/#/g;function Fn(s,c){this.h=this.g=null,this.i=s||null,this.j=!!c}function lt(s){s.g||(s.g=new Map,s.h=0,s.i&&td(s.i,function(c,h){s.add(decodeURIComponent(c.replace(/\+/g," ")),h)}))}n=Fn.prototype,n.add=function(s,c){lt(this),this.i=null,s=Qt(this,s);var h=this.g.get(s);return h||this.g.set(s,h=[]),h.push(c),this.h+=1,this};function Ca(s,c){lt(s),c=Qt(s,c),s.g.has(c)&&(s.i=null,s.h-=s.g.get(c).length,s.g.delete(c))}function ba(s,c){return lt(s),c=Qt(s,c),s.g.has(c)}n.forEach=function(s,c){lt(this),this.g.forEach(function(h,f){h.forEach(function(w){s.call(c,w,f,this)},this)},this)},n.na=function(){lt(this);const s=Array.from(this.g.values()),c=Array.from(this.g.keys()),h=[];for(let f=0;f<c.length;f++){const w=s[f];for(let R=0;R<w.length;R++)h.push(c[f])}return h},n.V=function(s){lt(this);let c=[];if(typeof s=="string")ba(this,s)&&(c=c.concat(this.g.get(Qt(this,s))));else{s=Array.from(this.g.values());for(let h=0;h<s.length;h++)c=c.concat(s[h])}return c},n.set=function(s,c){return lt(this),this.i=null,s=Qt(this,s),ba(this,s)&&(this.h-=this.g.get(s).length),this.g.set(s,[c]),this.h+=1,this},n.get=function(s,c){return s?(s=this.V(s),0<s.length?String(s[0]):c):c};function ka(s,c,h){Ca(s,c),0<h.length&&(s.i=null,s.g.set(Qt(s,c),N(h)),s.h+=h.length)}n.toString=function(){if(this.i)return this.i;if(!this.g)return"";const s=[],c=Array.from(this.g.keys());for(var h=0;h<c.length;h++){var f=c[h];const R=encodeURIComponent(String(f)),D=this.V(f);for(f=0;f<D.length;f++){var w=R;D[f]!==""&&(w+="="+encodeURIComponent(String(D[f]))),s.push(w)}}return this.i=s.join("&")};function Qt(s,c){return c=String(c),s.j&&(c=c.toLowerCase()),c}function ad(s,c){c&&!s.j&&(lt(s),s.i=null,s.g.forEach(function(h,f){var w=f.toLowerCase();f!=w&&(Ca(this,f),ka(this,w,h))},s)),s.j=c}function cd(s,c){const h=new On;if(u.Image){const f=new Image;f.onload=S(ht,h,"TestLoadImage: loaded",!0,c,f),f.onerror=S(ht,h,"TestLoadImage: error",!1,c,f),f.onabort=S(ht,h,"TestLoadImage: abort",!1,c,f),f.ontimeout=S(ht,h,"TestLoadImage: timeout",!1,c,f),u.setTimeout(function(){f.ontimeout&&f.ontimeout()},1e4),f.src=s}else c(!1)}function ud(s,c){const h=new On,f=new AbortController,w=setTimeout(()=>{f.abort(),ht(h,"TestPingServer: timeout",!1,c)},1e4);fetch(s,{signal:f.signal}).then(R=>{clearTimeout(w),R.ok?ht(h,"TestPingServer: ok",!0,c):ht(h,"TestPingServer: server error",!1,c)}).catch(()=>{clearTimeout(w),ht(h,"TestPingServer: error",!1,c)})}function ht(s,c,h,f,w){try{w&&(w.onload=null,w.onerror=null,w.onabort=null,w.ontimeout=null),f(h)}catch{}}function ld(){this.g=new Gh}function hd(s,c,h){const f=h||"";try{Aa(s,function(w,R){let D=w;d(w)&&(D=os(w)),c.push(f+R+"="+encodeURIComponent(D))})}catch(w){throw c.push(f+"type="+encodeURIComponent("_badmap")),w}}function Un(s){this.l=s.Ub||null,this.j=s.eb||!1}V(Un,as),Un.prototype.g=function(){return new Ur(this.l,this.j)},Un.prototype.i=(function(s){return function(){return s}})({});function Ur(s,c){ve.call(this),this.D=s,this.o=c,this.m=void 0,this.status=this.readyState=0,this.responseType=this.responseText=this.response=this.statusText="",this.onreadystatechange=null,this.u=new Headers,this.h=null,this.B="GET",this.A="",this.g=!1,this.v=this.j=this.l=null}V(Ur,ve),n=Ur.prototype,n.open=function(s,c){if(this.readyState!=0)throw this.abort(),Error("Error reopening a connection");this.B=s,this.A=c,this.readyState=1,qn(this)},n.send=function(s){if(this.readyState!=1)throw this.abort(),Error("need to call open() first. ");this.g=!0;const c={headers:this.u,method:this.B,credentials:this.m,cache:void 0};s&&(c.body=s),(this.D||u).fetch(new Request(this.A,c)).then(this.Sa.bind(this),this.ga.bind(this))},n.abort=function(){this.response=this.responseText="",this.u=new Headers,this.status=0,this.j&&this.j.cancel("Request was aborted.").catch(()=>{}),1<=this.readyState&&this.g&&this.readyState!=4&&(this.g=!1,Bn(this)),this.readyState=0},n.Sa=function(s){if(this.g&&(this.l=s,this.h||(this.status=this.l.status,this.statusText=this.l.statusText,this.h=s.headers,this.readyState=2,qn(this)),this.g&&(this.readyState=3,qn(this),this.g)))if(this.responseType==="arraybuffer")s.arrayBuffer().then(this.Qa.bind(this),this.ga.bind(this));else if(typeof u.ReadableStream<"u"&&"body"in s){if(this.j=s.body.getReader(),this.o){if(this.responseType)throw Error('responseType must be empty for "streamBinaryChunks" mode responses.');this.response=[]}else this.response=this.responseText="",this.v=new TextDecoder;Da(this)}else s.text().then(this.Ra.bind(this),this.ga.bind(this))};function Da(s){s.j.read().then(s.Pa.bind(s)).catch(s.ga.bind(s))}n.Pa=function(s){if(this.g){if(this.o&&s.value)this.response.push(s.value);else if(!this.o){var c=s.value?s.value:new Uint8Array(0);(c=this.v.decode(c,{stream:!s.done}))&&(this.response=this.responseText+=c)}s.done?Bn(this):qn(this),this.readyState==3&&Da(this)}},n.Ra=function(s){this.g&&(this.response=this.responseText=s,Bn(this))},n.Qa=function(s){this.g&&(this.response=s,Bn(this))},n.ga=function(){this.g&&Bn(this)};function Bn(s){s.readyState=4,s.l=null,s.j=null,s.v=null,qn(s)}n.setRequestHeader=function(s,c){this.u.append(s,c)},n.getResponseHeader=function(s){return this.h&&this.h.get(s.toLowerCase())||""},n.getAllResponseHeaders=function(){if(!this.h)return"";const s=[],c=this.h.entries();for(var h=c.next();!h.done;)h=h.value,s.push(h[0]+": "+h[1]),h=c.next();return s.join(`\r
`)};function qn(s){s.onreadystatechange&&s.onreadystatechange.call(s)}Object.defineProperty(Ur.prototype,"withCredentials",{get:function(){return this.m==="include"},set:function(s){this.m=s?"include":"same-origin"}});function Va(s){let c="";return ne(s,function(h,f){c+=f,c+=":",c+=h,c+=`\r
`}),c}function _s(s,c,h){e:{for(f in h){var f=!1;break e}f=!0}f||(h=Va(h),typeof s=="string"?h!=null&&encodeURIComponent(String(h)):J(s,c,h))}function ee(s){ve.call(this),this.headers=new Map,this.o=s||null,this.h=!1,this.v=this.g=null,this.D="",this.m=0,this.l="",this.j=this.B=this.u=this.A=!1,this.I=null,this.H="",this.J=!1}V(ee,ve);var dd=/^https?$/i,fd=["POST","PUT"];n=ee.prototype,n.Ha=function(s){this.J=s},n.ea=function(s,c,h,f){if(this.g)throw Error("[goog.net.XhrIo] Object is active with another request="+this.D+"; newUri="+s);c=c?c.toUpperCase():"GET",this.D=s,this.l="",this.m=0,this.A=!1,this.h=!0,this.g=this.o?this.o.g():ls.g(),this.v=this.o?aa(this.o):aa(ls),this.g.onreadystatechange=T(this.Ea,this);try{this.B=!0,this.g.open(c,String(s),!0),this.B=!1}catch(R){Na(this,R);return}if(s=h||"",h=new Map(this.headers),f)if(Object.getPrototypeOf(f)===Object.prototype)for(var w in f)h.set(w,f[w]);else if(typeof f.keys=="function"&&typeof f.get=="function")for(const R of f.keys())h.set(R,f.get(R));else throw Error("Unknown input type for opt_headers: "+String(f));f=Array.from(h.keys()).find(R=>R.toLowerCase()=="content-type"),w=u.FormData&&s instanceof u.FormData,!(0<=Array.prototype.indexOf.call(fd,c,void 0))||f||w||h.set("Content-Type","application/x-www-form-urlencoded;charset=utf-8");for(const[R,D]of h)this.g.setRequestHeader(R,D);this.H&&(this.g.responseType=this.H),"withCredentials"in this.g&&this.g.withCredentials!==this.J&&(this.g.withCredentials=this.J);try{La(this),this.u=!0,this.g.send(s),this.u=!1}catch(R){Na(this,R)}};function Na(s,c){s.h=!1,s.g&&(s.j=!0,s.g.abort(),s.j=!1),s.l=c,s.m=5,Oa(s),Br(s)}function Oa(s){s.A||(s.A=!0,Ae(s,"complete"),Ae(s,"error"))}n.abort=function(s){this.g&&this.h&&(this.h=!1,this.j=!0,this.g.abort(),this.j=!1,this.m=s||7,Ae(this,"complete"),Ae(this,"abort"),Br(this))},n.N=function(){this.g&&(this.h&&(this.h=!1,this.j=!0,this.g.abort(),this.j=!1),Br(this,!0)),ee.aa.N.call(this)},n.Ea=function(){this.s||(this.B||this.u||this.j?Ma(this):this.bb())},n.bb=function(){Ma(this)};function Ma(s){if(s.h&&typeof a<"u"&&(!s.v[1]||Qe(s)!=4||s.Z()!=2)){if(s.u&&Qe(s)==4)ra(s.Ea,0,s);else if(Ae(s,"readystatechange"),Qe(s)==4){s.h=!1;try{const D=s.Z();e:switch(D){case 200:case 201:case 202:case 204:case 206:case 304:case 1223:var c=!0;break e;default:c=!1}var h;if(!(h=c)){var f;if(f=D===0){var w=String(s.D).match(Ra)[1]||null;!w&&u.self&&u.self.location&&(w=u.self.location.protocol.slice(0,-1)),f=!dd.test(w?w.toLowerCase():"")}h=f}if(h)Ae(s,"complete"),Ae(s,"success");else{s.m=6;try{var R=2<Qe(s)?s.g.statusText:""}catch{R=""}s.l=R+" ["+s.Z()+"]",Oa(s)}}finally{Br(s)}}}}function Br(s,c){if(s.g){La(s);const h=s.g,f=s.v[0]?()=>{}:null;s.g=null,s.v=null,c||Ae(s,"ready");try{h.onreadystatechange=f}catch{}}}function La(s){s.I&&(u.clearTimeout(s.I),s.I=null)}n.isActive=function(){return!!this.g};function Qe(s){return s.g?s.g.readyState:0}n.Z=function(){try{return 2<Qe(this)?this.g.status:-1}catch{return-1}},n.oa=function(){try{return this.g?this.g.responseText:""}catch{return""}},n.Oa=function(s){if(this.g){var c=this.g.responseText;return s&&c.indexOf(s)==0&&(c=c.substring(s.length)),Wh(c)}};function xa(s){try{if(!s.g)return null;if("response"in s.g)return s.g.response;switch(s.H){case"":case"text":return s.g.responseText;case"arraybuffer":if("mozResponseArrayBuffer"in s.g)return s.g.mozResponseArrayBuffer}return null}catch{return null}}function pd(s){const c={};s=(s.g&&2<=Qe(s)&&s.g.getAllResponseHeaders()||"").split(`\r
`);for(let f=0;f<s.length;f++){if(W(s[f]))continue;var h=I(s[f]);const w=h[0];if(h=h[1],typeof h!="string")continue;h=h.trim();const R=c[w]||[];c[w]=R,R.push(h)}E(c,function(f){return f.join(", ")})}n.Ba=function(){return this.m},n.Ka=function(){return typeof this.l=="string"?this.l:String(this.l)};function jn(s,c,h){return h&&h.internalChannelParams&&h.internalChannelParams[s]||c}function Fa(s){this.Aa=0,this.i=[],this.j=new On,this.ia=this.qa=this.I=this.W=this.g=this.ya=this.D=this.H=this.m=this.S=this.o=null,this.Ya=this.U=0,this.Va=jn("failFast",!1,s),this.F=this.C=this.u=this.s=this.l=null,this.X=!0,this.za=this.T=-1,this.Y=this.v=this.B=0,this.Ta=jn("baseRetryDelayMs",5e3,s),this.cb=jn("retryDelaySeedMs",1e4,s),this.Wa=jn("forwardChannelMaxRetries",2,s),this.wa=jn("forwardChannelRequestTimeoutMs",2e4,s),this.pa=s&&s.xmlHttpFactory||void 0,this.Xa=s&&s.Tb||void 0,this.Ca=s&&s.useFetchStreams||!1,this.L=void 0,this.J=s&&s.supportsCrossDomainXhr||!1,this.K="",this.h=new va(s&&s.concurrentRequestLimit),this.Da=new ld,this.P=s&&s.fastHandshake||!1,this.O=s&&s.encodeInitMessageHeaders||!1,this.P&&this.O&&(this.O=!1),this.Ua=s&&s.Rb||!1,s&&s.xa&&this.j.xa(),s&&s.forceLongPolling&&(this.X=!1),this.ba=!this.P&&this.X&&s&&s.detectBufferingProxy||!1,this.ja=void 0,s&&s.longPollingTimeout&&0<s.longPollingTimeout&&(this.ja=s.longPollingTimeout),this.ca=void 0,this.R=0,this.M=!1,this.ka=this.A=null}n=Fa.prototype,n.la=8,n.G=1,n.connect=function(s,c,h,f){Re(0),this.W=s,this.H=c||{},h&&f!==void 0&&(this.H.OSID=h,this.H.OAID=f),this.F=this.X,this.I=Ha(this,null,this.W),jr(this)};function ys(s){if(Ua(s),s.G==3){var c=s.U++,h=Ke(s.I);if(J(h,"SID",s.K),J(h,"RID",c),J(h,"TYPE","terminate"),$n(s,h),c=new ut(s,s.j,c),c.L=2,c.v=Fr(Ke(h)),h=!1,u.navigator&&u.navigator.sendBeacon)try{h=u.navigator.sendBeacon(c.v.toString(),"")}catch{}!h&&u.Image&&(new Image().src=c.v,h=!0),h||(c.g=Ka(c.j,null),c.g.ea(c.v)),c.F=Date.now(),Mr(c)}Ga(s)}function qr(s){s.g&&(Es(s),s.g.cancel(),s.g=null)}function Ua(s){qr(s),s.u&&(u.clearTimeout(s.u),s.u=null),$r(s),s.h.cancel(),s.s&&(typeof s.s=="number"&&u.clearTimeout(s.s),s.s=null)}function jr(s){if(!Ea(s.h)&&!s.s){s.s=!0;var c=s.Ga;Sn||Jo(),Cn||(Sn(),Cn=!0),Ji.add(c,s),s.B=0}}function md(s,c){return Ia(s.h)>=s.h.j-(s.s?1:0)?!1:s.s?(s.i=c.D.concat(s.i),!0):s.G==1||s.G==2||s.B>=(s.Va?0:s.Wa)?!1:(s.s=Nn(T(s.Ga,s,c),Wa(s,s.B)),s.B++,!0)}n.Ga=function(s){if(this.s)if(this.s=null,this.G==1){if(!s){this.U=Math.floor(1e5*Math.random()),s=this.U++;const w=new ut(this,this.j,s);let R=this.o;if(this.S&&(R?(R=m(R),v(R,this.S)):R=this.S),this.m!==null||this.O||(w.H=R,R=null),this.P)e:{for(var c=0,h=0;h<this.i.length;h++){t:{var f=this.i[h];if("__data__"in f.map&&(f=f.map.__data__,typeof f=="string")){f=f.length;break t}f=void 0}if(f===void 0)break;if(c+=f,4096<c){c=h;break e}if(c===4096||h===this.i.length-1){c=h+1;break e}}c=1e3}else c=1e3;c=qa(this,w,c),h=Ke(this.I),J(h,"RID",s),J(h,"CVER",22),this.D&&J(h,"X-HTTP-Session-Id",this.D),$n(this,h),R&&(this.O?c="headers="+encodeURIComponent(String(Va(R)))+"&"+c:this.m&&_s(h,this.m,R)),gs(this.h,w),this.Ua&&J(h,"TYPE","init"),this.P?(J(h,"$req",c),J(h,"SID","null"),w.T=!0,ds(w,h,null)):ds(w,h,c),this.G=2}}else this.G==3&&(s?Ba(this,s):this.i.length==0||Ea(this.h)||Ba(this))};function Ba(s,c){var h;c?h=c.l:h=s.U++;const f=Ke(s.I);J(f,"SID",s.K),J(f,"RID",h),J(f,"AID",s.T),$n(s,f),s.m&&s.o&&_s(f,s.m,s.o),h=new ut(s,s.j,h,s.B+1),s.m===null&&(h.H=s.o),c&&(s.i=c.D.concat(s.i)),c=qa(s,h,1e3),h.I=Math.round(.5*s.wa)+Math.round(.5*s.wa*Math.random()),gs(s.h,h),ds(h,f,c)}function $n(s,c){s.H&&ne(s.H,function(h,f){J(c,f,h)}),s.l&&Aa({},function(h,f){J(c,f,h)})}function qa(s,c,h){h=Math.min(s.i.length,h);var f=s.l?T(s.l.Na,s.l,s):null;e:{var w=s.i;let R=-1;for(;;){const D=["count="+h];R==-1?0<h?(R=w[0].g,D.push("ofs="+R)):R=0:D.push("ofs="+R);let X=!0;for(let de=0;de<h;de++){let z=w[de].g;const Ee=w[de].map;if(z-=R,0>z)R=Math.max(0,w[de].g-100),X=!1;else try{hd(Ee,D,"req"+z+"_")}catch{f&&f(Ee)}}if(X){f=D.join("&");break e}}}return s=s.i.splice(0,h),c.D=s,f}function ja(s){if(!s.g&&!s.u){s.Y=1;var c=s.Fa;Sn||Jo(),Cn||(Sn(),Cn=!0),Ji.add(c,s),s.v=0}}function vs(s){return s.g||s.u||3<=s.v?!1:(s.Y++,s.u=Nn(T(s.Fa,s),Wa(s,s.v)),s.v++,!0)}n.Fa=function(){if(this.u=null,$a(this),this.ba&&!(this.M||this.g==null||0>=this.R)){var s=2*this.R;this.j.info("BP detection timer enabled: "+s),this.A=Nn(T(this.ab,this),s)}},n.ab=function(){this.A&&(this.A=null,this.j.info("BP detection timeout reached."),this.j.info("Buffering proxy detected and switch to long-polling!"),this.F=!1,this.M=!0,Re(10),qr(this),$a(this))};function Es(s){s.A!=null&&(u.clearTimeout(s.A),s.A=null)}function $a(s){s.g=new ut(s,s.j,"rpc",s.Y),s.m===null&&(s.g.H=s.o),s.g.O=0;var c=Ke(s.qa);J(c,"RID","rpc"),J(c,"SID",s.K),J(c,"AID",s.T),J(c,"CI",s.F?"0":"1"),!s.F&&s.ja&&J(c,"TO",s.ja),J(c,"TYPE","xmlhttp"),$n(s,c),s.m&&s.o&&_s(c,s.m,s.o),s.L&&(s.g.I=s.L);var h=s.g;s=s.ia,h.L=1,h.v=Fr(Ke(c)),h.m=null,h.P=!0,ga(h,s)}n.Za=function(){this.C!=null&&(this.C=null,qr(this),vs(this),Re(19))};function $r(s){s.C!=null&&(u.clearTimeout(s.C),s.C=null)}function za(s,c){var h=null;if(s.g==c){$r(s),Es(s),s.g=null;var f=2}else if(ms(s.h,c))h=c.D,Ta(s.h,c),f=1;else return;if(s.G!=0){if(c.o)if(f==1){h=c.m?c.m.length:0,c=Date.now()-c.F;var w=s.B;f=Vr(),Ae(f,new da(f,h)),jr(s)}else ja(s);else if(w=c.s,w==3||w==0&&0<c.X||!(f==1&&md(s,c)||f==2&&vs(s)))switch(h&&0<h.length&&(c=s.h,c.i=c.i.concat(h)),w){case 1:Ct(s,5);break;case 4:Ct(s,10);break;case 3:Ct(s,6);break;default:Ct(s,2)}}}function Wa(s,c){let h=s.Ta+Math.floor(Math.random()*s.cb);return s.isActive()||(h*=2),h*c}function Ct(s,c){if(s.j.info("Error code "+c),c==2){var h=T(s.fb,s),f=s.Xa;const w=!f;f=new St(f||"//www.google.com/images/cleardot.gif"),u.location&&u.location.protocol=="http"||Lr(f,"https"),Fr(f),w?cd(f.toString(),h):ud(f.toString(),h)}else Re(2);s.G=0,s.l&&s.l.sa(c),Ga(s),Ua(s)}n.fb=function(s){s?(this.j.info("Successfully pinged google.com"),Re(2)):(this.j.info("Failed to ping google.com"),Re(1))};function Ga(s){if(s.G=0,s.ka=[],s.l){const c=wa(s.h);(c.length!=0||s.i.length!=0)&&(k(s.ka,c),k(s.ka,s.i),s.h.i.length=0,N(s.i),s.i.length=0),s.l.ra()}}function Ha(s,c,h){var f=h instanceof St?Ke(h):new St(h);if(f.g!="")c&&(f.g=c+"."+f.g),xr(f,f.s);else{var w=u.location;f=w.protocol,c=c?c+"."+w.hostname:w.hostname,w=+w.port;var R=new St(null);f&&Lr(R,f),c&&(R.g=c),w&&xr(R,w),h&&(R.l=h),f=R}return h=s.D,c=s.ya,h&&c&&J(f,h,c),J(f,"VER",s.la),$n(s,f),f}function Ka(s,c,h){if(c&&!s.J)throw Error("Can't create secondary domain capable XhrIo object.");return c=s.Ca&&!s.pa?new ee(new Un({eb:h})):new ee(s.pa),c.Ha(s.J),c}n.isActive=function(){return!!this.l&&this.l.isActive(this)};function Qa(){}n=Qa.prototype,n.ua=function(){},n.ta=function(){},n.sa=function(){},n.ra=function(){},n.isActive=function(){return!0},n.Na=function(){};function zr(){}zr.prototype.g=function(s,c){return new Se(s,c)};function Se(s,c){ve.call(this),this.g=new Fa(c),this.l=s,this.h=c&&c.messageUrlParams||null,s=c&&c.messageHeaders||null,c&&c.clientProtocolHeaderRequired&&(s?s["X-Client-Protocol"]="webchannel":s={"X-Client-Protocol":"webchannel"}),this.g.o=s,s=c&&c.initMessageHeaders||null,c&&c.messageContentType&&(s?s["X-WebChannel-Content-Type"]=c.messageContentType:s={"X-WebChannel-Content-Type":c.messageContentType}),c&&c.va&&(s?s["X-WebChannel-Client-Profile"]=c.va:s={"X-WebChannel-Client-Profile":c.va}),this.g.S=s,(s=c&&c.Sb)&&!W(s)&&(this.g.m=s),this.v=c&&c.supportsCrossDomainXhr||!1,this.u=c&&c.sendRawJson||!1,(c=c&&c.httpSessionIdParam)&&!W(c)&&(this.g.D=c,s=this.h,s!==null&&c in s&&(s=this.h,c in s&&delete s[c])),this.j=new Yt(this)}V(Se,ve),Se.prototype.m=function(){this.g.l=this.j,this.v&&(this.g.J=!0),this.g.connect(this.l,this.h||void 0)},Se.prototype.close=function(){ys(this.g)},Se.prototype.o=function(s){var c=this.g;if(typeof s=="string"){var h={};h.__data__=s,s=h}else this.u&&(h={},h.__data__=os(s),s=h);c.i.push(new Jh(c.Ya++,s)),c.G==3&&jr(c)},Se.prototype.N=function(){this.g.l=null,delete this.j,ys(this.g),delete this.g,Se.aa.N.call(this)};function Ya(s){cs.call(this),s.__headers__&&(this.headers=s.__headers__,this.statusCode=s.__status__,delete s.__headers__,delete s.__status__);var c=s.__sm__;if(c){e:{for(const h in c){s=h;break e}s=void 0}(this.i=s)&&(s=this.i,c=c!==null&&s in c?c[s]:void 0),this.data=c}else this.data=s}V(Ya,cs);function Xa(){us.call(this),this.status=1}V(Xa,us);function Yt(s){this.g=s}V(Yt,Qa),Yt.prototype.ua=function(){Ae(this.g,"a")},Yt.prototype.ta=function(s){Ae(this.g,new Ya(s))},Yt.prototype.sa=function(s){Ae(this.g,new Xa)},Yt.prototype.ra=function(){Ae(this.g,"b")},zr.prototype.createWebChannel=zr.prototype.g,Se.prototype.send=Se.prototype.o,Se.prototype.open=Se.prototype.m,Se.prototype.close=Se.prototype.close,gl=function(){return new zr},ml=function(){return Vr()},pl=Rt,qs={mb:0,pb:1,qb:2,Jb:3,Ob:4,Lb:5,Mb:6,Kb:7,Ib:8,Nb:9,PROXY:10,NOPROXY:11,Gb:12,Cb:13,Db:14,Bb:15,Eb:16,Fb:17,ib:18,hb:19,jb:20},Nr.NO_ERROR=0,Nr.TIMEOUT=8,Nr.HTTP_ERROR=6,ti=Nr,fa.COMPLETE="complete",fl=fa,ca.EventType=Dn,Dn.OPEN="a",Dn.CLOSE="b",Dn.ERROR="c",Dn.MESSAGE="d",ve.prototype.listen=ve.prototype.K,Hn=ca,dl=Un,ee.prototype.listenOnce=ee.prototype.L,ee.prototype.getLastError=ee.prototype.Ka,ee.prototype.getLastErrorCode=ee.prototype.Ba,ee.prototype.getStatus=ee.prototype.Z,ee.prototype.getResponseJson=ee.prototype.Oa,ee.prototype.getResponseText=ee.prototype.oa,ee.prototype.send=ee.prototype.ea,ee.prototype.setWithCredentials=ee.prototype.Ha,hl=ee}).apply(typeof Hr<"u"?Hr:typeof self<"u"?self:typeof window<"u"?window:{});const Sc="@firebase/firestore";/**
 * @license
 * Copyright 2017 Google LLC
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
 */class we{constructor(e){this.uid=e}isAuthenticated(){return this.uid!=null}toKey(){return this.isAuthenticated()?"uid:"+this.uid:"anonymous-user"}isEqual(e){return e.uid===this.uid}}we.UNAUTHENTICATED=new we(null),we.GOOGLE_CREDENTIALS=new we("google-credentials-uid"),we.FIRST_PARTY=new we("first-party-uid"),we.MOCK_USER=new we("mock-user");/**
 * @license
 * Copyright 2017 Google LLC
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
 */let In="10.12.3";/**
 * @license
 * Copyright 2017 Google LLC
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
 */const Lt=new eo("@firebase/firestore");function zn(){return Lt.logLevel}function O(n,...e){if(Lt.logLevel<=j.DEBUG){const t=e.map(fo);Lt.debug(`Firestore (${In}): ${n}`,...t)}}function st(n,...e){if(Lt.logLevel<=j.ERROR){const t=e.map(fo);Lt.error(`Firestore (${In}): ${n}`,...t)}}function xt(n,...e){if(Lt.logLevel<=j.WARN){const t=e.map(fo);Lt.warn(`Firestore (${In}): ${n}`,...t)}}function fo(n){if(typeof n=="string")return n;try{/**
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
*/return(function(t){return JSON.stringify(t)})(n)}catch{return n}}/**
 * @license
 * Copyright 2017 Google LLC
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
 */function x(n="Unexpected state"){const e=`FIRESTORE (${In}) INTERNAL ASSERTION FAILED: `+n;throw st(e),new Error(e)}function K(n,e){n||x()}function U(n,e){return n}/**
 * @license
 * Copyright 2017 Google LLC
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
 */const P={OK:"ok",CANCELLED:"cancelled",UNKNOWN:"unknown",INVALID_ARGUMENT:"invalid-argument",DEADLINE_EXCEEDED:"deadline-exceeded",NOT_FOUND:"not-found",ALREADY_EXISTS:"already-exists",PERMISSION_DENIED:"permission-denied",UNAUTHENTICATED:"unauthenticated",RESOURCE_EXHAUSTED:"resource-exhausted",FAILED_PRECONDITION:"failed-precondition",ABORTED:"aborted",OUT_OF_RANGE:"out-of-range",UNIMPLEMENTED:"unimplemented",INTERNAL:"internal",UNAVAILABLE:"unavailable",DATA_LOSS:"data-loss"};class b extends at{constructor(e,t){super(e,t),this.code=e,this.message=t,this.toString=()=>`${this.name}: [code=${this.code}]: ${this.message}`}}/**
 * @license
 * Copyright 2017 Google LLC
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
 */class qe{constructor(){this.promise=new Promise(((e,t)=>{this.resolve=e,this.reject=t}))}}/**
 * @license
 * Copyright 2017 Google LLC
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
 */class _l{constructor(e,t){this.user=t,this.type="OAuth",this.headers=new Map,this.headers.set("Authorization",`Bearer ${e}`)}}class yl{getToken(){return Promise.resolve(null)}invalidateToken(){}start(e,t){e.enqueueRetryable((()=>t(we.UNAUTHENTICATED)))}shutdown(){}}class yg{constructor(e){this.token=e,this.changeListener=null}getToken(){return Promise.resolve(this.token)}invalidateToken(){}start(e,t){this.changeListener=t,e.enqueueRetryable((()=>t(this.token.user)))}shutdown(){this.changeListener=null}}class vg{constructor(e){this.t=e,this.currentUser=we.UNAUTHENTICATED,this.i=0,this.forceRefresh=!1,this.auth=null}start(e,t){let r=this.i;const i=l=>this.i!==r?(r=this.i,t(l)):Promise.resolve();let o=new qe;this.o=()=>{this.i++,this.currentUser=this.u(),o.resolve(),o=new qe,e.enqueueRetryable((()=>i(this.currentUser)))};const a=()=>{const l=o;e.enqueueRetryable((async()=>{await l.promise,await i(this.currentUser)}))},u=l=>{O("FirebaseAuthCredentialsProvider","Auth detected"),this.auth=l,this.auth.addAuthTokenListener(this.o),a()};this.t.onInit((l=>u(l))),setTimeout((()=>{if(!this.auth){const l=this.t.getImmediate({optional:!0});l?u(l):(O("FirebaseAuthCredentialsProvider","Auth not yet detected"),o.resolve(),o=new qe)}}),0),a()}getToken(){const e=this.i,t=this.forceRefresh;return this.forceRefresh=!1,this.auth?this.auth.getToken(t).then((r=>this.i!==e?(O("FirebaseAuthCredentialsProvider","getToken aborted due to token change."),this.getToken()):r?(K(typeof r.accessToken=="string"),new _l(r.accessToken,this.currentUser)):null)):Promise.resolve(null)}invalidateToken(){this.forceRefresh=!0}shutdown(){this.auth&&this.auth.removeAuthTokenListener(this.o)}u(){const e=this.auth&&this.auth.getUid();return K(e===null||typeof e=="string"),new we(e)}}class Eg{constructor(e,t,r){this.l=e,this.h=t,this.P=r,this.type="FirstParty",this.user=we.FIRST_PARTY,this.I=new Map}T(){return this.P?this.P():null}get headers(){this.I.set("X-Goog-AuthUser",this.l);const e=this.T();return e&&this.I.set("Authorization",e),this.h&&this.I.set("X-Goog-Iam-Authorization-Token",this.h),this.I}}class Ig{constructor(e,t,r){this.l=e,this.h=t,this.P=r}getToken(){return Promise.resolve(new Eg(this.l,this.h,this.P))}start(e,t){e.enqueueRetryable((()=>t(we.FIRST_PARTY)))}shutdown(){}invalidateToken(){}}class Tg{constructor(e){this.value=e,this.type="AppCheck",this.headers=new Map,e&&e.length>0&&this.headers.set("x-firebase-appcheck",this.value)}}class wg{constructor(e){this.A=e,this.forceRefresh=!1,this.appCheck=null,this.R=null}start(e,t){const r=o=>{o.error!=null&&O("FirebaseAppCheckTokenProvider",`Error getting App Check token; using placeholder token instead. Error: ${o.error.message}`);const a=o.token!==this.R;return this.R=o.token,O("FirebaseAppCheckTokenProvider",`Received ${a?"new":"existing"} token.`),a?t(o.token):Promise.resolve()};this.o=o=>{e.enqueueRetryable((()=>r(o)))};const i=o=>{O("FirebaseAppCheckTokenProvider","AppCheck detected"),this.appCheck=o,this.appCheck.addTokenListener(this.o)};this.A.onInit((o=>i(o))),setTimeout((()=>{if(!this.appCheck){const o=this.A.getImmediate({optional:!0});o?i(o):O("FirebaseAppCheckTokenProvider","AppCheck not yet detected")}}),0)}getToken(){const e=this.forceRefresh;return this.forceRefresh=!1,this.appCheck?this.appCheck.getToken(e).then((t=>t?(K(typeof t.token=="string"),this.R=t.token,new Tg(t.token)):null)):Promise.resolve(null)}invalidateToken(){this.forceRefresh=!0}shutdown(){this.appCheck&&this.appCheck.removeTokenListener(this.o)}}/**
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
 */function Ag(n){const e=typeof self<"u"&&(self.crypto||self.msCrypto),t=new Uint8Array(n);if(e&&typeof e.getRandomValues=="function")e.getRandomValues(t);else for(let r=0;r<n;r++)t[r]=Math.floor(256*Math.random());return t}/**
 * @license
 * Copyright 2017 Google LLC
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
 */class po{static newId(){const e="ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789",t=Math.floor(256/e.length)*e.length;let r="";for(;r.length<20;){const i=Ag(40);for(let o=0;o<i.length;++o)r.length<20&&i[o]<t&&(r+=e.charAt(i[o]%e.length))}return r}}function G(n,e){return n<e?-1:n>e?1:0}function ln(n,e,t){return n.length===e.length&&n.every(((r,i)=>t(r,e[i])))}/**
 * @license
 * Copyright 2017 Google LLC
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
 */class ae{constructor(e,t){if(this.seconds=e,this.nanoseconds=t,t<0)throw new b(P.INVALID_ARGUMENT,"Timestamp nanoseconds out of range: "+t);if(t>=1e9)throw new b(P.INVALID_ARGUMENT,"Timestamp nanoseconds out of range: "+t);if(e<-62135596800)throw new b(P.INVALID_ARGUMENT,"Timestamp seconds out of range: "+e);if(e>=253402300800)throw new b(P.INVALID_ARGUMENT,"Timestamp seconds out of range: "+e)}static now(){return ae.fromMillis(Date.now())}static fromDate(e){return ae.fromMillis(e.getTime())}static fromMillis(e){const t=Math.floor(e/1e3),r=Math.floor(1e6*(e-1e3*t));return new ae(t,r)}toDate(){return new Date(this.toMillis())}toMillis(){return 1e3*this.seconds+this.nanoseconds/1e6}_compareTo(e){return this.seconds===e.seconds?G(this.nanoseconds,e.nanoseconds):G(this.seconds,e.seconds)}isEqual(e){return e.seconds===this.seconds&&e.nanoseconds===this.nanoseconds}toString(){return"Timestamp(seconds="+this.seconds+", nanoseconds="+this.nanoseconds+")"}toJSON(){return{seconds:this.seconds,nanoseconds:this.nanoseconds}}valueOf(){const e=this.seconds- -62135596800;return String(e).padStart(12,"0")+"."+String(this.nanoseconds).padStart(9,"0")}}/**
 * @license
 * Copyright 2017 Google LLC
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
 */class F{constructor(e){this.timestamp=e}static fromTimestamp(e){return new F(e)}static min(){return new F(new ae(0,0))}static max(){return new F(new ae(253402300799,999999999))}compareTo(e){return this.timestamp._compareTo(e.timestamp)}isEqual(e){return this.timestamp.isEqual(e.timestamp)}toMicroseconds(){return 1e6*this.timestamp.seconds+this.timestamp.nanoseconds/1e3}toString(){return"SnapshotVersion("+this.timestamp.toString()+")"}toTimestamp(){return this.timestamp}}/**
 * @license
 * Copyright 2017 Google LLC
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
 */class sr{constructor(e,t,r){t===void 0?t=0:t>e.length&&x(),r===void 0?r=e.length-t:r>e.length-t&&x(),this.segments=e,this.offset=t,this.len=r}get length(){return this.len}isEqual(e){return sr.comparator(this,e)===0}child(e){const t=this.segments.slice(this.offset,this.limit());return e instanceof sr?e.forEach((r=>{t.push(r)})):t.push(e),this.construct(t)}limit(){return this.offset+this.length}popFirst(e){return e=e===void 0?1:e,this.construct(this.segments,this.offset+e,this.length-e)}popLast(){return this.construct(this.segments,this.offset,this.length-1)}firstSegment(){return this.segments[this.offset]}lastSegment(){return this.get(this.length-1)}get(e){return this.segments[this.offset+e]}isEmpty(){return this.length===0}isPrefixOf(e){if(e.length<this.length)return!1;for(let t=0;t<this.length;t++)if(this.get(t)!==e.get(t))return!1;return!0}isImmediateParentOf(e){if(this.length+1!==e.length)return!1;for(let t=0;t<this.length;t++)if(this.get(t)!==e.get(t))return!1;return!0}forEach(e){for(let t=this.offset,r=this.limit();t<r;t++)e(this.segments[t])}toArray(){return this.segments.slice(this.offset,this.limit())}static comparator(e,t){const r=Math.min(e.length,t.length);for(let i=0;i<r;i++){const o=e.get(i),a=t.get(i);if(o<a)return-1;if(o>a)return 1}return e.length<t.length?-1:e.length>t.length?1:0}}class Y extends sr{construct(e,t,r){return new Y(e,t,r)}canonicalString(){return this.toArray().join("/")}toString(){return this.canonicalString()}toUriEncodedString(){return this.toArray().map(encodeURIComponent).join("/")}static fromString(...e){const t=[];for(const r of e){if(r.indexOf("//")>=0)throw new b(P.INVALID_ARGUMENT,`Invalid segment (${r}). Paths must not contain // in them.`);t.push(...r.split("/").filter((i=>i.length>0)))}return new Y(t)}static emptyPath(){return new Y([])}}const Rg=/^[_a-zA-Z][_a-zA-Z0-9]*$/;class le extends sr{construct(e,t,r){return new le(e,t,r)}static isValidIdentifier(e){return Rg.test(e)}canonicalString(){return this.toArray().map((e=>(e=e.replace(/\\/g,"\\\\").replace(/`/g,"\\`"),le.isValidIdentifier(e)||(e="`"+e+"`"),e))).join(".")}toString(){return this.canonicalString()}isKeyField(){return this.length===1&&this.get(0)==="__name__"}static keyField(){return new le(["__name__"])}static fromServerFormat(e){const t=[];let r="",i=0;const o=()=>{if(r.length===0)throw new b(P.INVALID_ARGUMENT,`Invalid field path (${e}). Paths must not be empty, begin with '.', end with '.', or contain '..'`);t.push(r),r=""};let a=!1;for(;i<e.length;){const u=e[i];if(u==="\\"){if(i+1===e.length)throw new b(P.INVALID_ARGUMENT,"Path has trailing escape character: "+e);const l=e[i+1];if(l!=="\\"&&l!=="."&&l!=="`")throw new b(P.INVALID_ARGUMENT,"Path has invalid escape sequence: "+e);r+=l,i+=2}else u==="`"?(a=!a,i++):u!=="."||a?(r+=u,i++):(o(),i++)}if(o(),a)throw new b(P.INVALID_ARGUMENT,"Unterminated ` in path: "+e);return new le(t)}static emptyPath(){return new le([])}}/**
 * @license
 * Copyright 2017 Google LLC
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
 */class M{constructor(e){this.path=e}static fromPath(e){return new M(Y.fromString(e))}static fromName(e){return new M(Y.fromString(e).popFirst(5))}static empty(){return new M(Y.emptyPath())}get collectionGroup(){return this.path.popLast().lastSegment()}hasCollectionId(e){return this.path.length>=2&&this.path.get(this.path.length-2)===e}getCollectionGroup(){return this.path.get(this.path.length-2)}getCollectionPath(){return this.path.popLast()}isEqual(e){return e!==null&&Y.comparator(this.path,e.path)===0}toString(){return this.path.toString()}static comparator(e,t){return Y.comparator(e.path,t.path)}static isDocumentKey(e){return e.length%2==0}static fromSegments(e){return new M(new Y(e.slice()))}}function Pg(n,e){const t=n.toTimestamp().seconds,r=n.toTimestamp().nanoseconds+1,i=F.fromTimestamp(r===1e9?new ae(t+1,0):new ae(t,r));return new Et(i,M.empty(),e)}function Sg(n){return new Et(n.readTime,n.key,-1)}class Et{constructor(e,t,r){this.readTime=e,this.documentKey=t,this.largestBatchId=r}static min(){return new Et(F.min(),M.empty(),-1)}static max(){return new Et(F.max(),M.empty(),-1)}}function Cg(n,e){let t=n.readTime.compareTo(e.readTime);return t!==0?t:(t=M.comparator(n.documentKey,e.documentKey),t!==0?t:G(n.largestBatchId,e.largestBatchId))}/**
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
 */const bg="The current tab is not in the required state to perform this operation. It might be necessary to refresh the browser tab.";class kg{constructor(){this.onCommittedListeners=[]}addOnCommittedListener(e){this.onCommittedListeners.push(e)}raiseOnCommittedEvent(){this.onCommittedListeners.forEach((e=>e()))}}/**
 * @license
 * Copyright 2017 Google LLC
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
 */async function _r(n){if(n.code!==P.FAILED_PRECONDITION||n.message!==bg)throw n;O("LocalStore","Unexpectedly lost primary lease")}/**
 * @license
 * Copyright 2017 Google LLC
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
 */class C{constructor(e){this.nextCallback=null,this.catchCallback=null,this.result=void 0,this.error=void 0,this.isDone=!1,this.callbackAttached=!1,e((t=>{this.isDone=!0,this.result=t,this.nextCallback&&this.nextCallback(t)}),(t=>{this.isDone=!0,this.error=t,this.catchCallback&&this.catchCallback(t)}))}catch(e){return this.next(void 0,e)}next(e,t){return this.callbackAttached&&x(),this.callbackAttached=!0,this.isDone?this.error?this.wrapFailure(t,this.error):this.wrapSuccess(e,this.result):new C(((r,i)=>{this.nextCallback=o=>{this.wrapSuccess(e,o).next(r,i)},this.catchCallback=o=>{this.wrapFailure(t,o).next(r,i)}}))}toPromise(){return new Promise(((e,t)=>{this.next(e,t)}))}wrapUserFunction(e){try{const t=e();return t instanceof C?t:C.resolve(t)}catch(t){return C.reject(t)}}wrapSuccess(e,t){return e?this.wrapUserFunction((()=>e(t))):C.resolve(t)}wrapFailure(e,t){return e?this.wrapUserFunction((()=>e(t))):C.reject(t)}static resolve(e){return new C(((t,r)=>{t(e)}))}static reject(e){return new C(((t,r)=>{r(e)}))}static waitFor(e){return new C(((t,r)=>{let i=0,o=0,a=!1;e.forEach((u=>{++i,u.next((()=>{++o,a&&o===i&&t()}),(l=>r(l)))})),a=!0,o===i&&t()}))}static or(e){let t=C.resolve(!1);for(const r of e)t=t.next((i=>i?C.resolve(i):r()));return t}static forEach(e,t){const r=[];return e.forEach(((i,o)=>{r.push(t.call(this,i,o))})),this.waitFor(r)}static mapArray(e,t){return new C(((r,i)=>{const o=e.length,a=new Array(o);let u=0;for(let l=0;l<o;l++){const d=l;t(e[d]).next((p=>{a[d]=p,++u,u===o&&r(a)}),(p=>i(p)))}}))}static doWhile(e,t){return new C(((r,i)=>{const o=()=>{e()===!0?t().next((()=>{o()}),i):r()};o()}))}}function Dg(n){const e=n.match(/Android ([\d.]+)/i),t=e?e[1].split(".").slice(0,2).join("."):"-1";return Number(t)}function yr(n){return n.name==="IndexedDbTransactionError"}/**
 * @license
 * Copyright 2018 Google LLC
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
 */class mo{constructor(e,t){this.previousValue=e,t&&(t.sequenceNumberHandler=r=>this.ie(r),this.se=r=>t.writeSequenceNumber(r))}ie(e){return this.previousValue=Math.max(e,this.previousValue),this.previousValue}next(){const e=++this.previousValue;return this.se&&this.se(e),e}}mo.oe=-1;function vr(n){return n==null}function di(n){return n===0&&1/n==-1/0}function Vg(n){return typeof n=="number"&&Number.isInteger(n)&&!di(n)&&n<=Number.MAX_SAFE_INTEGER&&n>=Number.MIN_SAFE_INTEGER}/**
 * @license
 * Copyright 2017 Google LLC
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
 */function Cc(n){let e=0;for(const t in n)Object.prototype.hasOwnProperty.call(n,t)&&e++;return e}function qt(n,e){for(const t in n)Object.prototype.hasOwnProperty.call(n,t)&&e(t,n[t])}function vl(n){for(const e in n)if(Object.prototype.hasOwnProperty.call(n,e))return!1;return!0}/**
 * @license
 * Copyright 2017 Google LLC
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
 */class Z{constructor(e,t){this.comparator=e,this.root=t||fe.EMPTY}insert(e,t){return new Z(this.comparator,this.root.insert(e,t,this.comparator).copy(null,null,fe.BLACK,null,null))}remove(e){return new Z(this.comparator,this.root.remove(e,this.comparator).copy(null,null,fe.BLACK,null,null))}get(e){let t=this.root;for(;!t.isEmpty();){const r=this.comparator(e,t.key);if(r===0)return t.value;r<0?t=t.left:r>0&&(t=t.right)}return null}indexOf(e){let t=0,r=this.root;for(;!r.isEmpty();){const i=this.comparator(e,r.key);if(i===0)return t+r.left.size;i<0?r=r.left:(t+=r.left.size+1,r=r.right)}return-1}isEmpty(){return this.root.isEmpty()}get size(){return this.root.size}minKey(){return this.root.minKey()}maxKey(){return this.root.maxKey()}inorderTraversal(e){return this.root.inorderTraversal(e)}forEach(e){this.inorderTraversal(((t,r)=>(e(t,r),!1)))}toString(){const e=[];return this.inorderTraversal(((t,r)=>(e.push(`${t}:${r}`),!1))),`{${e.join(", ")}}`}reverseTraversal(e){return this.root.reverseTraversal(e)}getIterator(){return new Kr(this.root,null,this.comparator,!1)}getIteratorFrom(e){return new Kr(this.root,e,this.comparator,!1)}getReverseIterator(){return new Kr(this.root,null,this.comparator,!0)}getReverseIteratorFrom(e){return new Kr(this.root,e,this.comparator,!0)}}class Kr{constructor(e,t,r,i){this.isReverse=i,this.nodeStack=[];let o=1;for(;!e.isEmpty();)if(o=t?r(e.key,t):1,t&&i&&(o*=-1),o<0)e=this.isReverse?e.left:e.right;else{if(o===0){this.nodeStack.push(e);break}this.nodeStack.push(e),e=this.isReverse?e.right:e.left}}getNext(){let e=this.nodeStack.pop();const t={key:e.key,value:e.value};if(this.isReverse)for(e=e.left;!e.isEmpty();)this.nodeStack.push(e),e=e.right;else for(e=e.right;!e.isEmpty();)this.nodeStack.push(e),e=e.left;return t}hasNext(){return this.nodeStack.length>0}peek(){if(this.nodeStack.length===0)return null;const e=this.nodeStack[this.nodeStack.length-1];return{key:e.key,value:e.value}}}class fe{constructor(e,t,r,i,o){this.key=e,this.value=t,this.color=r??fe.RED,this.left=i??fe.EMPTY,this.right=o??fe.EMPTY,this.size=this.left.size+1+this.right.size}copy(e,t,r,i,o){return new fe(e??this.key,t??this.value,r??this.color,i??this.left,o??this.right)}isEmpty(){return!1}inorderTraversal(e){return this.left.inorderTraversal(e)||e(this.key,this.value)||this.right.inorderTraversal(e)}reverseTraversal(e){return this.right.reverseTraversal(e)||e(this.key,this.value)||this.left.reverseTraversal(e)}min(){return this.left.isEmpty()?this:this.left.min()}minKey(){return this.min().key}maxKey(){return this.right.isEmpty()?this.key:this.right.maxKey()}insert(e,t,r){let i=this;const o=r(e,i.key);return i=o<0?i.copy(null,null,null,i.left.insert(e,t,r),null):o===0?i.copy(null,t,null,null,null):i.copy(null,null,null,null,i.right.insert(e,t,r)),i.fixUp()}removeMin(){if(this.left.isEmpty())return fe.EMPTY;let e=this;return e.left.isRed()||e.left.left.isRed()||(e=e.moveRedLeft()),e=e.copy(null,null,null,e.left.removeMin(),null),e.fixUp()}remove(e,t){let r,i=this;if(t(e,i.key)<0)i.left.isEmpty()||i.left.isRed()||i.left.left.isRed()||(i=i.moveRedLeft()),i=i.copy(null,null,null,i.left.remove(e,t),null);else{if(i.left.isRed()&&(i=i.rotateRight()),i.right.isEmpty()||i.right.isRed()||i.right.left.isRed()||(i=i.moveRedRight()),t(e,i.key)===0){if(i.right.isEmpty())return fe.EMPTY;r=i.right.min(),i=i.copy(r.key,r.value,null,null,i.right.removeMin())}i=i.copy(null,null,null,null,i.right.remove(e,t))}return i.fixUp()}isRed(){return this.color}fixUp(){let e=this;return e.right.isRed()&&!e.left.isRed()&&(e=e.rotateLeft()),e.left.isRed()&&e.left.left.isRed()&&(e=e.rotateRight()),e.left.isRed()&&e.right.isRed()&&(e=e.colorFlip()),e}moveRedLeft(){let e=this.colorFlip();return e.right.left.isRed()&&(e=e.copy(null,null,null,null,e.right.rotateRight()),e=e.rotateLeft(),e=e.colorFlip()),e}moveRedRight(){let e=this.colorFlip();return e.left.left.isRed()&&(e=e.rotateRight(),e=e.colorFlip()),e}rotateLeft(){const e=this.copy(null,null,fe.RED,null,this.right.left);return this.right.copy(null,null,this.color,e,null)}rotateRight(){const e=this.copy(null,null,fe.RED,this.left.right,null);return this.left.copy(null,null,this.color,null,e)}colorFlip(){const e=this.left.copy(null,null,!this.left.color,null,null),t=this.right.copy(null,null,!this.right.color,null,null);return this.copy(null,null,!this.color,e,t)}checkMaxDepth(){const e=this.check();return Math.pow(2,e)<=this.size+1}check(){if(this.isRed()&&this.left.isRed()||this.right.isRed())throw x();const e=this.left.check();if(e!==this.right.check())throw x();return e+(this.isRed()?0:1)}}fe.EMPTY=null,fe.RED=!0,fe.BLACK=!1;fe.EMPTY=new class{constructor(){this.size=0}get key(){throw x()}get value(){throw x()}get color(){throw x()}get left(){throw x()}get right(){throw x()}copy(e,t,r,i,o){return this}insert(e,t,r){return new fe(e,t)}remove(e,t){return this}isEmpty(){return!0}inorderTraversal(e){return!1}reverseTraversal(e){return!1}minKey(){return null}maxKey(){return null}isRed(){return!1}checkMaxDepth(){return!0}check(){return 0}};/**
 * @license
 * Copyright 2017 Google LLC
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
 */class pe{constructor(e){this.comparator=e,this.data=new Z(this.comparator)}has(e){return this.data.get(e)!==null}first(){return this.data.minKey()}last(){return this.data.maxKey()}get size(){return this.data.size}indexOf(e){return this.data.indexOf(e)}forEach(e){this.data.inorderTraversal(((t,r)=>(e(t),!1)))}forEachInRange(e,t){const r=this.data.getIteratorFrom(e[0]);for(;r.hasNext();){const i=r.getNext();if(this.comparator(i.key,e[1])>=0)return;t(i.key)}}forEachWhile(e,t){let r;for(r=t!==void 0?this.data.getIteratorFrom(t):this.data.getIterator();r.hasNext();)if(!e(r.getNext().key))return}firstAfterOrEqual(e){const t=this.data.getIteratorFrom(e);return t.hasNext()?t.getNext().key:null}getIterator(){return new bc(this.data.getIterator())}getIteratorFrom(e){return new bc(this.data.getIteratorFrom(e))}add(e){return this.copy(this.data.remove(e).insert(e,!0))}delete(e){return this.has(e)?this.copy(this.data.remove(e)):this}isEmpty(){return this.data.isEmpty()}unionWith(e){let t=this;return t.size<e.size&&(t=e,e=this),e.forEach((r=>{t=t.add(r)})),t}isEqual(e){if(!(e instanceof pe)||this.size!==e.size)return!1;const t=this.data.getIterator(),r=e.data.getIterator();for(;t.hasNext();){const i=t.getNext().key,o=r.getNext().key;if(this.comparator(i,o)!==0)return!1}return!0}toArray(){const e=[];return this.forEach((t=>{e.push(t)})),e}toString(){const e=[];return this.forEach((t=>e.push(t))),"SortedSet("+e.toString()+")"}copy(e){const t=new pe(this.comparator);return t.data=e,t}}class bc{constructor(e){this.iter=e}getNext(){return this.iter.getNext().key}hasNext(){return this.iter.hasNext()}}/**
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
 */class be{constructor(e){this.fields=e,e.sort(le.comparator)}static empty(){return new be([])}unionWith(e){let t=new pe(le.comparator);for(const r of this.fields)t=t.add(r);for(const r of e)t=t.add(r);return new be(t.toArray())}covers(e){for(const t of this.fields)if(t.isPrefixOf(e))return!0;return!1}isEqual(e){return ln(this.fields,e.fields,((t,r)=>t.isEqual(r)))}}/**
 * @license
 * Copyright 2023 Google LLC
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
 */class El extends Error{constructor(){super(...arguments),this.name="Base64DecodeError"}}/**
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
 */class _e{constructor(e){this.binaryString=e}static fromBase64String(e){const t=(function(i){try{return atob(i)}catch(o){throw typeof DOMException<"u"&&o instanceof DOMException?new El("Invalid base64 string: "+o):o}})(e);return new _e(t)}static fromUint8Array(e){const t=(function(i){let o="";for(let a=0;a<i.length;++a)o+=String.fromCharCode(i[a]);return o})(e);return new _e(t)}[Symbol.iterator](){let e=0;return{next:()=>e<this.binaryString.length?{value:this.binaryString.charCodeAt(e++),done:!1}:{value:void 0,done:!0}}}toBase64(){return(function(t){return btoa(t)})(this.binaryString)}toUint8Array(){return(function(t){const r=new Uint8Array(t.length);for(let i=0;i<t.length;i++)r[i]=t.charCodeAt(i);return r})(this.binaryString)}approximateByteSize(){return 2*this.binaryString.length}compareTo(e){return G(this.binaryString,e.binaryString)}isEqual(e){return this.binaryString===e.binaryString}}_e.EMPTY_BYTE_STRING=new _e("");const Ng=new RegExp(/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.(\d+))?Z$/);function It(n){if(K(!!n),typeof n=="string"){let e=0;const t=Ng.exec(n);if(K(!!t),t[1]){let i=t[1];i=(i+"000000000").substr(0,9),e=Number(i)}const r=new Date(n);return{seconds:Math.floor(r.getTime()/1e3),nanos:e}}return{seconds:ie(n.seconds),nanos:ie(n.nanos)}}function ie(n){return typeof n=="number"?n:typeof n=="string"?Number(n):0}function Ft(n){return typeof n=="string"?_e.fromBase64String(n):_e.fromUint8Array(n)}/**
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
 */function bi(n){var e,t;return((t=(((e=n?.mapValue)===null||e===void 0?void 0:e.fields)||{}).__type__)===null||t===void 0?void 0:t.stringValue)==="server_timestamp"}function go(n){const e=n.mapValue.fields.__previous_value__;return bi(e)?go(e):e}function or(n){const e=It(n.mapValue.fields.__local_write_time__.timestampValue);return new ae(e.seconds,e.nanos)}/**
 * @license
 * Copyright 2017 Google LLC
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
 */class Og{constructor(e,t,r,i,o,a,u,l,d){this.databaseId=e,this.appId=t,this.persistenceKey=r,this.host=i,this.ssl=o,this.forceLongPolling=a,this.autoDetectLongPolling=u,this.longPollingOptions=l,this.useFetchStreams=d}}class hn{constructor(e,t){this.projectId=e,this.database=t||"(default)"}static empty(){return new hn("","")}get isDefaultDatabase(){return this.database==="(default)"}isEqual(e){return e instanceof hn&&e.projectId===this.projectId&&e.database===this.database}}/**
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
 */const Qr={mapValue:{}};function Ut(n){return"nullValue"in n?0:"booleanValue"in n?1:"integerValue"in n||"doubleValue"in n?2:"timestampValue"in n?3:"stringValue"in n?5:"bytesValue"in n?6:"referenceValue"in n?7:"geoPointValue"in n?8:"arrayValue"in n?9:"mapValue"in n?bi(n)?4:Mg(n)?9007199254740991:10:x()}function ze(n,e){if(n===e)return!0;const t=Ut(n);if(t!==Ut(e))return!1;switch(t){case 0:case 9007199254740991:return!0;case 1:return n.booleanValue===e.booleanValue;case 4:return or(n).isEqual(or(e));case 3:return(function(i,o){if(typeof i.timestampValue=="string"&&typeof o.timestampValue=="string"&&i.timestampValue.length===o.timestampValue.length)return i.timestampValue===o.timestampValue;const a=It(i.timestampValue),u=It(o.timestampValue);return a.seconds===u.seconds&&a.nanos===u.nanos})(n,e);case 5:return n.stringValue===e.stringValue;case 6:return(function(i,o){return Ft(i.bytesValue).isEqual(Ft(o.bytesValue))})(n,e);case 7:return n.referenceValue===e.referenceValue;case 8:return(function(i,o){return ie(i.geoPointValue.latitude)===ie(o.geoPointValue.latitude)&&ie(i.geoPointValue.longitude)===ie(o.geoPointValue.longitude)})(n,e);case 2:return(function(i,o){if("integerValue"in i&&"integerValue"in o)return ie(i.integerValue)===ie(o.integerValue);if("doubleValue"in i&&"doubleValue"in o){const a=ie(i.doubleValue),u=ie(o.doubleValue);return a===u?di(a)===di(u):isNaN(a)&&isNaN(u)}return!1})(n,e);case 9:return ln(n.arrayValue.values||[],e.arrayValue.values||[],ze);case 10:return(function(i,o){const a=i.mapValue.fields||{},u=o.mapValue.fields||{};if(Cc(a)!==Cc(u))return!1;for(const l in a)if(a.hasOwnProperty(l)&&(u[l]===void 0||!ze(a[l],u[l])))return!1;return!0})(n,e);default:return x()}}function ar(n,e){return(n.values||[]).find((t=>ze(t,e)))!==void 0}function dn(n,e){if(n===e)return 0;const t=Ut(n),r=Ut(e);if(t!==r)return G(t,r);switch(t){case 0:case 9007199254740991:return 0;case 1:return G(n.booleanValue,e.booleanValue);case 2:return(function(o,a){const u=ie(o.integerValue||o.doubleValue),l=ie(a.integerValue||a.doubleValue);return u<l?-1:u>l?1:u===l?0:isNaN(u)?isNaN(l)?0:-1:1})(n,e);case 3:return kc(n.timestampValue,e.timestampValue);case 4:return kc(or(n),or(e));case 5:return G(n.stringValue,e.stringValue);case 6:return(function(o,a){const u=Ft(o),l=Ft(a);return u.compareTo(l)})(n.bytesValue,e.bytesValue);case 7:return(function(o,a){const u=o.split("/"),l=a.split("/");for(let d=0;d<u.length&&d<l.length;d++){const p=G(u[d],l[d]);if(p!==0)return p}return G(u.length,l.length)})(n.referenceValue,e.referenceValue);case 8:return(function(o,a){const u=G(ie(o.latitude),ie(a.latitude));return u!==0?u:G(ie(o.longitude),ie(a.longitude))})(n.geoPointValue,e.geoPointValue);case 9:return(function(o,a){const u=o.values||[],l=a.values||[];for(let d=0;d<u.length&&d<l.length;++d){const p=dn(u[d],l[d]);if(p)return p}return G(u.length,l.length)})(n.arrayValue,e.arrayValue);case 10:return(function(o,a){if(o===Qr.mapValue&&a===Qr.mapValue)return 0;if(o===Qr.mapValue)return 1;if(a===Qr.mapValue)return-1;const u=o.fields||{},l=Object.keys(u),d=a.fields||{},p=Object.keys(d);l.sort(),p.sort();for(let y=0;y<l.length&&y<p.length;++y){const T=G(l[y],p[y]);if(T!==0)return T;const S=dn(u[l[y]],d[p[y]]);if(S!==0)return S}return G(l.length,p.length)})(n.mapValue,e.mapValue);default:throw x()}}function kc(n,e){if(typeof n=="string"&&typeof e=="string"&&n.length===e.length)return G(n,e);const t=It(n),r=It(e),i=G(t.seconds,r.seconds);return i!==0?i:G(t.nanos,r.nanos)}function fn(n){return js(n)}function js(n){return"nullValue"in n?"null":"booleanValue"in n?""+n.booleanValue:"integerValue"in n?""+n.integerValue:"doubleValue"in n?""+n.doubleValue:"timestampValue"in n?(function(t){const r=It(t);return`time(${r.seconds},${r.nanos})`})(n.timestampValue):"stringValue"in n?n.stringValue:"bytesValue"in n?(function(t){return Ft(t).toBase64()})(n.bytesValue):"referenceValue"in n?(function(t){return M.fromName(t).toString()})(n.referenceValue):"geoPointValue"in n?(function(t){return`geo(${t.latitude},${t.longitude})`})(n.geoPointValue):"arrayValue"in n?(function(t){let r="[",i=!0;for(const o of t.values||[])i?i=!1:r+=",",r+=js(o);return r+"]"})(n.arrayValue):"mapValue"in n?(function(t){const r=Object.keys(t.fields||{}).sort();let i="{",o=!0;for(const a of r)o?o=!1:i+=",",i+=`${a}:${js(t.fields[a])}`;return i+"}"})(n.mapValue):x()}function fi(n,e){return{referenceValue:`projects/${n.projectId}/databases/${n.database}/documents/${e.path.canonicalString()}`}}function $s(n){return!!n&&"integerValue"in n}function _o(n){return!!n&&"arrayValue"in n}function Dc(n){return!!n&&"nullValue"in n}function Vc(n){return!!n&&"doubleValue"in n&&isNaN(Number(n.doubleValue))}function ni(n){return!!n&&"mapValue"in n}function Jn(n){if(n.geoPointValue)return{geoPointValue:Object.assign({},n.geoPointValue)};if(n.timestampValue&&typeof n.timestampValue=="object")return{timestampValue:Object.assign({},n.timestampValue)};if(n.mapValue){const e={mapValue:{fields:{}}};return qt(n.mapValue.fields,((t,r)=>e.mapValue.fields[t]=Jn(r))),e}if(n.arrayValue){const e={arrayValue:{values:[]}};for(let t=0;t<(n.arrayValue.values||[]).length;++t)e.arrayValue.values[t]=Jn(n.arrayValue.values[t]);return e}return Object.assign({},n)}function Mg(n){return(((n.mapValue||{}).fields||{}).__type__||{}).stringValue==="__max__"}/**
 * @license
 * Copyright 2017 Google LLC
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
 */class Pe{constructor(e){this.value=e}static empty(){return new Pe({mapValue:{}})}field(e){if(e.isEmpty())return this.value;{let t=this.value;for(let r=0;r<e.length-1;++r)if(t=(t.mapValue.fields||{})[e.get(r)],!ni(t))return null;return t=(t.mapValue.fields||{})[e.lastSegment()],t||null}}set(e,t){this.getFieldsMap(e.popLast())[e.lastSegment()]=Jn(t)}setAll(e){let t=le.emptyPath(),r={},i=[];e.forEach(((a,u)=>{if(!t.isImmediateParentOf(u)){const l=this.getFieldsMap(t);this.applyChanges(l,r,i),r={},i=[],t=u.popLast()}a?r[u.lastSegment()]=Jn(a):i.push(u.lastSegment())}));const o=this.getFieldsMap(t);this.applyChanges(o,r,i)}delete(e){const t=this.field(e.popLast());ni(t)&&t.mapValue.fields&&delete t.mapValue.fields[e.lastSegment()]}isEqual(e){return ze(this.value,e.value)}getFieldsMap(e){let t=this.value;t.mapValue.fields||(t.mapValue={fields:{}});for(let r=0;r<e.length;++r){let i=t.mapValue.fields[e.get(r)];ni(i)&&i.mapValue.fields||(i={mapValue:{fields:{}}},t.mapValue.fields[e.get(r)]=i),t=i}return t.mapValue.fields}applyChanges(e,t,r){qt(t,((i,o)=>e[i]=o));for(const i of r)delete e[i]}clone(){return new Pe(Jn(this.value))}}function Il(n){const e=[];return qt(n.fields,((t,r)=>{const i=new le([t]);if(ni(r)){const o=Il(r.mapValue).fields;if(o.length===0)e.push(i);else for(const a of o)e.push(i.child(a))}else e.push(i)})),new be(e)}/**
 * @license
 * Copyright 2017 Google LLC
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
 */class ue{constructor(e,t,r,i,o,a,u){this.key=e,this.documentType=t,this.version=r,this.readTime=i,this.createTime=o,this.data=a,this.documentState=u}static newInvalidDocument(e){return new ue(e,0,F.min(),F.min(),F.min(),Pe.empty(),0)}static newFoundDocument(e,t,r,i){return new ue(e,1,t,F.min(),r,i,0)}static newNoDocument(e,t){return new ue(e,2,t,F.min(),F.min(),Pe.empty(),0)}static newUnknownDocument(e,t){return new ue(e,3,t,F.min(),F.min(),Pe.empty(),2)}convertToFoundDocument(e,t){return!this.createTime.isEqual(F.min())||this.documentType!==2&&this.documentType!==0||(this.createTime=e),this.version=e,this.documentType=1,this.data=t,this.documentState=0,this}convertToNoDocument(e){return this.version=e,this.documentType=2,this.data=Pe.empty(),this.documentState=0,this}convertToUnknownDocument(e){return this.version=e,this.documentType=3,this.data=Pe.empty(),this.documentState=2,this}setHasCommittedMutations(){return this.documentState=2,this}setHasLocalMutations(){return this.documentState=1,this.version=F.min(),this}setReadTime(e){return this.readTime=e,this}get hasLocalMutations(){return this.documentState===1}get hasCommittedMutations(){return this.documentState===2}get hasPendingWrites(){return this.hasLocalMutations||this.hasCommittedMutations}isValidDocument(){return this.documentType!==0}isFoundDocument(){return this.documentType===1}isNoDocument(){return this.documentType===2}isUnknownDocument(){return this.documentType===3}isEqual(e){return e instanceof ue&&this.key.isEqual(e.key)&&this.version.isEqual(e.version)&&this.documentType===e.documentType&&this.documentState===e.documentState&&this.data.isEqual(e.data)}mutableCopy(){return new ue(this.key,this.documentType,this.version,this.readTime,this.createTime,this.data.clone(),this.documentState)}toString(){return`Document(${this.key}, ${this.version}, ${JSON.stringify(this.data.value)}, {createTime: ${this.createTime}}), {documentType: ${this.documentType}}), {documentState: ${this.documentState}})`}}/**
 * @license
 * Copyright 2022 Google LLC
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
 */class pn{constructor(e,t){this.position=e,this.inclusive=t}}function Nc(n,e,t){let r=0;for(let i=0;i<n.position.length;i++){const o=e[i],a=n.position[i];if(o.field.isKeyField()?r=M.comparator(M.fromName(a.referenceValue),t.key):r=dn(a,t.data.field(o.field)),o.dir==="desc"&&(r*=-1),r!==0)break}return r}function Oc(n,e){if(n===null)return e===null;if(e===null||n.inclusive!==e.inclusive||n.position.length!==e.position.length)return!1;for(let t=0;t<n.position.length;t++)if(!ze(n.position[t],e.position[t]))return!1;return!0}/**
 * @license
 * Copyright 2022 Google LLC
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
 */class cr{constructor(e,t="asc"){this.field=e,this.dir=t}}function Lg(n,e){return n.dir===e.dir&&n.field.isEqual(e.field)}/**
 * @license
 * Copyright 2022 Google LLC
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
 */class Tl{}class se extends Tl{constructor(e,t,r){super(),this.field=e,this.op=t,this.value=r}static create(e,t,r){return e.isKeyField()?t==="in"||t==="not-in"?this.createKeyFieldInFilter(e,t,r):new Fg(e,t,r):t==="array-contains"?new qg(e,r):t==="in"?new jg(e,r):t==="not-in"?new $g(e,r):t==="array-contains-any"?new zg(e,r):new se(e,t,r)}static createKeyFieldInFilter(e,t,r){return t==="in"?new Ug(e,r):new Bg(e,r)}matches(e){const t=e.data.field(this.field);return this.op==="!="?t!==null&&this.matchesComparison(dn(t,this.value)):t!==null&&Ut(this.value)===Ut(t)&&this.matchesComparison(dn(t,this.value))}matchesComparison(e){switch(this.op){case"<":return e<0;case"<=":return e<=0;case"==":return e===0;case"!=":return e!==0;case">":return e>0;case">=":return e>=0;default:return x()}}isInequality(){return["<","<=",">",">=","!=","not-in"].indexOf(this.op)>=0}getFlattenedFilters(){return[this]}getFilters(){return[this]}}class Le extends Tl{constructor(e,t){super(),this.filters=e,this.op=t,this.ae=null}static create(e,t){return new Le(e,t)}matches(e){return wl(this)?this.filters.find((t=>!t.matches(e)))===void 0:this.filters.find((t=>t.matches(e)))!==void 0}getFlattenedFilters(){return this.ae!==null||(this.ae=this.filters.reduce(((e,t)=>e.concat(t.getFlattenedFilters())),[])),this.ae}getFilters(){return Object.assign([],this.filters)}}function wl(n){return n.op==="and"}function Al(n){return xg(n)&&wl(n)}function xg(n){for(const e of n.filters)if(e instanceof Le)return!1;return!0}function zs(n){if(n instanceof se)return n.field.canonicalString()+n.op.toString()+fn(n.value);if(Al(n))return n.filters.map((e=>zs(e))).join(",");{const e=n.filters.map((t=>zs(t))).join(",");return`${n.op}(${e})`}}function Rl(n,e){return n instanceof se?(function(r,i){return i instanceof se&&r.op===i.op&&r.field.isEqual(i.field)&&ze(r.value,i.value)})(n,e):n instanceof Le?(function(r,i){return i instanceof Le&&r.op===i.op&&r.filters.length===i.filters.length?r.filters.reduce(((o,a,u)=>o&&Rl(a,i.filters[u])),!0):!1})(n,e):void x()}function Pl(n){return n instanceof se?(function(t){return`${t.field.canonicalString()} ${t.op} ${fn(t.value)}`})(n):n instanceof Le?(function(t){return t.op.toString()+" {"+t.getFilters().map(Pl).join(" ,")+"}"})(n):"Filter"}class Fg extends se{constructor(e,t,r){super(e,t,r),this.key=M.fromName(r.referenceValue)}matches(e){const t=M.comparator(e.key,this.key);return this.matchesComparison(t)}}class Ug extends se{constructor(e,t){super(e,"in",t),this.keys=Sl("in",t)}matches(e){return this.keys.some((t=>t.isEqual(e.key)))}}class Bg extends se{constructor(e,t){super(e,"not-in",t),this.keys=Sl("not-in",t)}matches(e){return!this.keys.some((t=>t.isEqual(e.key)))}}function Sl(n,e){var t;return(((t=e.arrayValue)===null||t===void 0?void 0:t.values)||[]).map((r=>M.fromName(r.referenceValue)))}class qg extends se{constructor(e,t){super(e,"array-contains",t)}matches(e){const t=e.data.field(this.field);return _o(t)&&ar(t.arrayValue,this.value)}}class jg extends se{constructor(e,t){super(e,"in",t)}matches(e){const t=e.data.field(this.field);return t!==null&&ar(this.value.arrayValue,t)}}class $g extends se{constructor(e,t){super(e,"not-in",t)}matches(e){if(ar(this.value.arrayValue,{nullValue:"NULL_VALUE"}))return!1;const t=e.data.field(this.field);return t!==null&&!ar(this.value.arrayValue,t)}}class zg extends se{constructor(e,t){super(e,"array-contains-any",t)}matches(e){const t=e.data.field(this.field);return!(!_o(t)||!t.arrayValue.values)&&t.arrayValue.values.some((r=>ar(this.value.arrayValue,r)))}}/**
 * @license
 * Copyright 2019 Google LLC
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
 */class Wg{constructor(e,t=null,r=[],i=[],o=null,a=null,u=null){this.path=e,this.collectionGroup=t,this.orderBy=r,this.filters=i,this.limit=o,this.startAt=a,this.endAt=u,this.ue=null}}function Mc(n,e=null,t=[],r=[],i=null,o=null,a=null){return new Wg(n,e,t,r,i,o,a)}function yo(n){const e=U(n);if(e.ue===null){let t=e.path.canonicalString();e.collectionGroup!==null&&(t+="|cg:"+e.collectionGroup),t+="|f:",t+=e.filters.map((r=>zs(r))).join(","),t+="|ob:",t+=e.orderBy.map((r=>(function(o){return o.field.canonicalString()+o.dir})(r))).join(","),vr(e.limit)||(t+="|l:",t+=e.limit),e.startAt&&(t+="|lb:",t+=e.startAt.inclusive?"b:":"a:",t+=e.startAt.position.map((r=>fn(r))).join(",")),e.endAt&&(t+="|ub:",t+=e.endAt.inclusive?"a:":"b:",t+=e.endAt.position.map((r=>fn(r))).join(",")),e.ue=t}return e.ue}function vo(n,e){if(n.limit!==e.limit||n.orderBy.length!==e.orderBy.length)return!1;for(let t=0;t<n.orderBy.length;t++)if(!Lg(n.orderBy[t],e.orderBy[t]))return!1;if(n.filters.length!==e.filters.length)return!1;for(let t=0;t<n.filters.length;t++)if(!Rl(n.filters[t],e.filters[t]))return!1;return n.collectionGroup===e.collectionGroup&&!!n.path.isEqual(e.path)&&!!Oc(n.startAt,e.startAt)&&Oc(n.endAt,e.endAt)}function Ws(n){return M.isDocumentKey(n.path)&&n.collectionGroup===null&&n.filters.length===0}/**
 * @license
 * Copyright 2017 Google LLC
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
 */class jt{constructor(e,t=null,r=[],i=[],o=null,a="F",u=null,l=null){this.path=e,this.collectionGroup=t,this.explicitOrderBy=r,this.filters=i,this.limit=o,this.limitType=a,this.startAt=u,this.endAt=l,this.ce=null,this.le=null,this.he=null,this.startAt,this.endAt}}function Gg(n,e,t,r,i,o,a,u){return new jt(n,e,t,r,i,o,a,u)}function ki(n){return new jt(n)}function Lc(n){return n.filters.length===0&&n.limit===null&&n.startAt==null&&n.endAt==null&&(n.explicitOrderBy.length===0||n.explicitOrderBy.length===1&&n.explicitOrderBy[0].field.isKeyField())}function Eo(n){return n.collectionGroup!==null}function sn(n){const e=U(n);if(e.ce===null){e.ce=[];const t=new Set;for(const o of e.explicitOrderBy)e.ce.push(o),t.add(o.field.canonicalString());const r=e.explicitOrderBy.length>0?e.explicitOrderBy[e.explicitOrderBy.length-1].dir:"asc";(function(a){let u=new pe(le.comparator);return a.filters.forEach((l=>{l.getFlattenedFilters().forEach((d=>{d.isInequality()&&(u=u.add(d.field))}))})),u})(e).forEach((o=>{t.has(o.canonicalString())||o.isKeyField()||e.ce.push(new cr(o,r))})),t.has(le.keyField().canonicalString())||e.ce.push(new cr(le.keyField(),r))}return e.ce}function je(n){const e=U(n);return e.le||(e.le=Hg(e,sn(n))),e.le}function Hg(n,e){if(n.limitType==="F")return Mc(n.path,n.collectionGroup,e,n.filters,n.limit,n.startAt,n.endAt);{e=e.map((i=>{const o=i.dir==="desc"?"asc":"desc";return new cr(i.field,o)}));const t=n.endAt?new pn(n.endAt.position,n.endAt.inclusive):null,r=n.startAt?new pn(n.startAt.position,n.startAt.inclusive):null;return Mc(n.path,n.collectionGroup,e,n.filters,n.limit,t,r)}}function Gs(n,e){const t=n.filters.concat([e]);return new jt(n.path,n.collectionGroup,n.explicitOrderBy.slice(),t,n.limit,n.limitType,n.startAt,n.endAt)}function pi(n,e,t){return new jt(n.path,n.collectionGroup,n.explicitOrderBy.slice(),n.filters.slice(),e,t,n.startAt,n.endAt)}function Di(n,e){return vo(je(n),je(e))&&n.limitType===e.limitType}function Cl(n){return`${yo(je(n))}|lt:${n.limitType}`}function Jt(n){return`Query(target=${(function(t){let r=t.path.canonicalString();return t.collectionGroup!==null&&(r+=" collectionGroup="+t.collectionGroup),t.filters.length>0&&(r+=`, filters: [${t.filters.map((i=>Pl(i))).join(", ")}]`),vr(t.limit)||(r+=", limit: "+t.limit),t.orderBy.length>0&&(r+=`, orderBy: [${t.orderBy.map((i=>(function(a){return`${a.field.canonicalString()} (${a.dir})`})(i))).join(", ")}]`),t.startAt&&(r+=", startAt: ",r+=t.startAt.inclusive?"b:":"a:",r+=t.startAt.position.map((i=>fn(i))).join(",")),t.endAt&&(r+=", endAt: ",r+=t.endAt.inclusive?"a:":"b:",r+=t.endAt.position.map((i=>fn(i))).join(",")),`Target(${r})`})(je(n))}; limitType=${n.limitType})`}function Vi(n,e){return e.isFoundDocument()&&(function(r,i){const o=i.key.path;return r.collectionGroup!==null?i.key.hasCollectionId(r.collectionGroup)&&r.path.isPrefixOf(o):M.isDocumentKey(r.path)?r.path.isEqual(o):r.path.isImmediateParentOf(o)})(n,e)&&(function(r,i){for(const o of sn(r))if(!o.field.isKeyField()&&i.data.field(o.field)===null)return!1;return!0})(n,e)&&(function(r,i){for(const o of r.filters)if(!o.matches(i))return!1;return!0})(n,e)&&(function(r,i){return!(r.startAt&&!(function(a,u,l){const d=Nc(a,u,l);return a.inclusive?d<=0:d<0})(r.startAt,sn(r),i)||r.endAt&&!(function(a,u,l){const d=Nc(a,u,l);return a.inclusive?d>=0:d>0})(r.endAt,sn(r),i))})(n,e)}function Kg(n){return n.collectionGroup||(n.path.length%2==1?n.path.lastSegment():n.path.get(n.path.length-2))}function bl(n){return(e,t)=>{let r=!1;for(const i of sn(n)){const o=Qg(i,e,t);if(o!==0)return o;r=r||i.field.isKeyField()}return 0}}function Qg(n,e,t){const r=n.field.isKeyField()?M.comparator(e.key,t.key):(function(o,a,u){const l=a.data.field(o),d=u.data.field(o);return l!==null&&d!==null?dn(l,d):x()})(n.field,e,t);switch(n.dir){case"asc":return r;case"desc":return-1*r;default:return x()}}/**
 * @license
 * Copyright 2017 Google LLC
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
 */class Tn{constructor(e,t){this.mapKeyFn=e,this.equalsFn=t,this.inner={},this.innerSize=0}get(e){const t=this.mapKeyFn(e),r=this.inner[t];if(r!==void 0){for(const[i,o]of r)if(this.equalsFn(i,e))return o}}has(e){return this.get(e)!==void 0}set(e,t){const r=this.mapKeyFn(e),i=this.inner[r];if(i===void 0)return this.inner[r]=[[e,t]],void this.innerSize++;for(let o=0;o<i.length;o++)if(this.equalsFn(i[o][0],e))return void(i[o]=[e,t]);i.push([e,t]),this.innerSize++}delete(e){const t=this.mapKeyFn(e),r=this.inner[t];if(r===void 0)return!1;for(let i=0;i<r.length;i++)if(this.equalsFn(r[i][0],e))return r.length===1?delete this.inner[t]:r.splice(i,1),this.innerSize--,!0;return!1}forEach(e){qt(this.inner,((t,r)=>{for(const[i,o]of r)e(i,o)}))}isEmpty(){return vl(this.inner)}size(){return this.innerSize}}/**
 * @license
 * Copyright 2017 Google LLC
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
 */const Yg=new Z(M.comparator);function ot(){return Yg}const kl=new Z(M.comparator);function Kn(...n){let e=kl;for(const t of n)e=e.insert(t.key,t);return e}function Dl(n){let e=kl;return n.forEach(((t,r)=>e=e.insert(t,r.overlayedDocument))),e}function kt(){return Zn()}function Vl(){return Zn()}function Zn(){return new Tn((n=>n.toString()),((n,e)=>n.isEqual(e)))}const Xg=new Z(M.comparator),Jg=new pe(M.comparator);function q(...n){let e=Jg;for(const t of n)e=e.add(t);return e}const Zg=new pe(G);function e_(){return Zg}/**
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
 */function Nl(n,e){if(n.useProto3Json){if(isNaN(e))return{doubleValue:"NaN"};if(e===1/0)return{doubleValue:"Infinity"};if(e===-1/0)return{doubleValue:"-Infinity"}}return{doubleValue:di(e)?"-0":e}}function Ol(n){return{integerValue:""+n}}function Ml(n,e){return Vg(e)?Ol(e):Nl(n,e)}/**
 * @license
 * Copyright 2018 Google LLC
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
 */class Ni{constructor(){this._=void 0}}function t_(n,e,t){return n instanceof ur?(function(i,o){const a={fields:{__type__:{stringValue:"server_timestamp"},__local_write_time__:{timestampValue:{seconds:i.seconds,nanos:i.nanoseconds}}}};return o&&bi(o)&&(o=go(o)),o&&(a.fields.__previous_value__=o),{mapValue:a}})(t,e):n instanceof mn?xl(n,e):n instanceof lr?Fl(n,e):(function(i,o){const a=Ll(i,o),u=xc(a)+xc(i.Pe);return $s(a)&&$s(i.Pe)?Ol(u):Nl(i.serializer,u)})(n,e)}function n_(n,e,t){return n instanceof mn?xl(n,e):n instanceof lr?Fl(n,e):t}function Ll(n,e){return n instanceof hr?(function(r){return $s(r)||(function(o){return!!o&&"doubleValue"in o})(r)})(e)?e:{integerValue:0}:null}class ur extends Ni{}class mn extends Ni{constructor(e){super(),this.elements=e}}function xl(n,e){const t=Ul(e);for(const r of n.elements)t.some((i=>ze(i,r)))||t.push(r);return{arrayValue:{values:t}}}class lr extends Ni{constructor(e){super(),this.elements=e}}function Fl(n,e){let t=Ul(e);for(const r of n.elements)t=t.filter((i=>!ze(i,r)));return{arrayValue:{values:t}}}class hr extends Ni{constructor(e,t){super(),this.serializer=e,this.Pe=t}}function xc(n){return ie(n.integerValue||n.doubleValue)}function Ul(n){return _o(n)&&n.arrayValue.values?n.arrayValue.values.slice():[]}/**
 * @license
 * Copyright 2017 Google LLC
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
 */class Io{constructor(e,t){this.field=e,this.transform=t}}function r_(n,e){return n.field.isEqual(e.field)&&(function(r,i){return r instanceof mn&&i instanceof mn||r instanceof lr&&i instanceof lr?ln(r.elements,i.elements,ze):r instanceof hr&&i instanceof hr?ze(r.Pe,i.Pe):r instanceof ur&&i instanceof ur})(n.transform,e.transform)}class i_{constructor(e,t){this.version=e,this.transformResults=t}}class oe{constructor(e,t){this.updateTime=e,this.exists=t}static none(){return new oe}static exists(e){return new oe(void 0,e)}static updateTime(e){return new oe(e)}get isNone(){return this.updateTime===void 0&&this.exists===void 0}isEqual(e){return this.exists===e.exists&&(this.updateTime?!!e.updateTime&&this.updateTime.isEqual(e.updateTime):!e.updateTime)}}function ri(n,e){return n.updateTime!==void 0?e.isFoundDocument()&&e.version.isEqual(n.updateTime):n.exists===void 0||n.exists===e.isFoundDocument()}class Oi{}function Bl(n,e){if(!n.hasLocalMutations||e&&e.fields.length===0)return null;if(e===null)return n.isNoDocument()?new Ir(n.key,oe.none()):new Er(n.key,n.data,oe.none());{const t=n.data,r=Pe.empty();let i=new pe(le.comparator);for(let o of e.fields)if(!i.has(o)){let a=t.field(o);a===null&&o.length>1&&(o=o.popLast(),a=t.field(o)),a===null?r.delete(o):r.set(o,a),i=i.add(o)}return new At(n.key,r,new be(i.toArray()),oe.none())}}function s_(n,e,t){n instanceof Er?(function(i,o,a){const u=i.value.clone(),l=Uc(i.fieldTransforms,o,a.transformResults);u.setAll(l),o.convertToFoundDocument(a.version,u).setHasCommittedMutations()})(n,e,t):n instanceof At?(function(i,o,a){if(!ri(i.precondition,o))return void o.convertToUnknownDocument(a.version);const u=Uc(i.fieldTransforms,o,a.transformResults),l=o.data;l.setAll(ql(i)),l.setAll(u),o.convertToFoundDocument(a.version,l).setHasCommittedMutations()})(n,e,t):(function(i,o,a){o.convertToNoDocument(a.version).setHasCommittedMutations()})(0,e,t)}function er(n,e,t,r){return n instanceof Er?(function(o,a,u,l){if(!ri(o.precondition,a))return u;const d=o.value.clone(),p=Bc(o.fieldTransforms,l,a);return d.setAll(p),a.convertToFoundDocument(a.version,d).setHasLocalMutations(),null})(n,e,t,r):n instanceof At?(function(o,a,u,l){if(!ri(o.precondition,a))return u;const d=Bc(o.fieldTransforms,l,a),p=a.data;return p.setAll(ql(o)),p.setAll(d),a.convertToFoundDocument(a.version,p).setHasLocalMutations(),u===null?null:u.unionWith(o.fieldMask.fields).unionWith(o.fieldTransforms.map((y=>y.field)))})(n,e,t,r):(function(o,a,u){return ri(o.precondition,a)?(a.convertToNoDocument(a.version).setHasLocalMutations(),null):u})(n,e,t)}function o_(n,e){let t=null;for(const r of n.fieldTransforms){const i=e.data.field(r.field),o=Ll(r.transform,i||null);o!=null&&(t===null&&(t=Pe.empty()),t.set(r.field,o))}return t||null}function Fc(n,e){return n.type===e.type&&!!n.key.isEqual(e.key)&&!!n.precondition.isEqual(e.precondition)&&!!(function(r,i){return r===void 0&&i===void 0||!(!r||!i)&&ln(r,i,((o,a)=>r_(o,a)))})(n.fieldTransforms,e.fieldTransforms)&&(n.type===0?n.value.isEqual(e.value):n.type!==1||n.data.isEqual(e.data)&&n.fieldMask.isEqual(e.fieldMask))}class Er extends Oi{constructor(e,t,r,i=[]){super(),this.key=e,this.value=t,this.precondition=r,this.fieldTransforms=i,this.type=0}getFieldMask(){return null}}class At extends Oi{constructor(e,t,r,i,o=[]){super(),this.key=e,this.data=t,this.fieldMask=r,this.precondition=i,this.fieldTransforms=o,this.type=1}getFieldMask(){return this.fieldMask}}function ql(n){const e=new Map;return n.fieldMask.fields.forEach((t=>{if(!t.isEmpty()){const r=n.data.field(t);e.set(t,r)}})),e}function Uc(n,e,t){const r=new Map;K(n.length===t.length);for(let i=0;i<t.length;i++){const o=n[i],a=o.transform,u=e.data.field(o.field);r.set(o.field,n_(a,u,t[i]))}return r}function Bc(n,e,t){const r=new Map;for(const i of n){const o=i.transform,a=t.data.field(i.field);r.set(i.field,t_(o,a,e))}return r}class Ir extends Oi{constructor(e,t){super(),this.key=e,this.precondition=t,this.type=2,this.fieldTransforms=[]}getFieldMask(){return null}}class jl extends Oi{constructor(e,t){super(),this.key=e,this.precondition=t,this.type=3,this.fieldTransforms=[]}getFieldMask(){return null}}/**
 * @license
 * Copyright 2017 Google LLC
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
 */class a_{constructor(e,t,r,i){this.batchId=e,this.localWriteTime=t,this.baseMutations=r,this.mutations=i}applyToRemoteDocument(e,t){const r=t.mutationResults;for(let i=0;i<this.mutations.length;i++){const o=this.mutations[i];o.key.isEqual(e.key)&&s_(o,e,r[i])}}applyToLocalView(e,t){for(const r of this.baseMutations)r.key.isEqual(e.key)&&(t=er(r,e,t,this.localWriteTime));for(const r of this.mutations)r.key.isEqual(e.key)&&(t=er(r,e,t,this.localWriteTime));return t}applyToLocalDocumentSet(e,t){const r=Vl();return this.mutations.forEach((i=>{const o=e.get(i.key),a=o.overlayedDocument;let u=this.applyToLocalView(a,o.mutatedFields);u=t.has(i.key)?null:u;const l=Bl(a,u);l!==null&&r.set(i.key,l),a.isValidDocument()||a.convertToNoDocument(F.min())})),r}keys(){return this.mutations.reduce(((e,t)=>e.add(t.key)),q())}isEqual(e){return this.batchId===e.batchId&&ln(this.mutations,e.mutations,((t,r)=>Fc(t,r)))&&ln(this.baseMutations,e.baseMutations,((t,r)=>Fc(t,r)))}}class To{constructor(e,t,r,i){this.batch=e,this.commitVersion=t,this.mutationResults=r,this.docVersions=i}static from(e,t,r){K(e.mutations.length===r.length);let i=(function(){return Xg})();const o=e.mutations;for(let a=0;a<o.length;a++)i=i.insert(o[a].key,r[a].version);return new To(e,t,r,i)}}/**
 * @license
 * Copyright 2022 Google LLC
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
 */class c_{constructor(e,t){this.largestBatchId=e,this.mutation=t}getKey(){return this.mutation.key}isEqual(e){return e!==null&&this.mutation===e.mutation}toString(){return`Overlay{
      largestBatchId: ${this.largestBatchId},
      mutation: ${this.mutation.toString()}
    }`}}/**
 * @license
 * Copyright 2017 Google LLC
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
 */class u_{constructor(e,t){this.count=e,this.unchangedNames=t}}/**
 * @license
 * Copyright 2017 Google LLC
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
 */var re,$;function $l(n){switch(n){default:return x();case P.CANCELLED:case P.UNKNOWN:case P.DEADLINE_EXCEEDED:case P.RESOURCE_EXHAUSTED:case P.INTERNAL:case P.UNAVAILABLE:case P.UNAUTHENTICATED:return!1;case P.INVALID_ARGUMENT:case P.NOT_FOUND:case P.ALREADY_EXISTS:case P.PERMISSION_DENIED:case P.FAILED_PRECONDITION:case P.ABORTED:case P.OUT_OF_RANGE:case P.UNIMPLEMENTED:case P.DATA_LOSS:return!0}}function zl(n){if(n===void 0)return st("GRPC error has no .code"),P.UNKNOWN;switch(n){case re.OK:return P.OK;case re.CANCELLED:return P.CANCELLED;case re.UNKNOWN:return P.UNKNOWN;case re.DEADLINE_EXCEEDED:return P.DEADLINE_EXCEEDED;case re.RESOURCE_EXHAUSTED:return P.RESOURCE_EXHAUSTED;case re.INTERNAL:return P.INTERNAL;case re.UNAVAILABLE:return P.UNAVAILABLE;case re.UNAUTHENTICATED:return P.UNAUTHENTICATED;case re.INVALID_ARGUMENT:return P.INVALID_ARGUMENT;case re.NOT_FOUND:return P.NOT_FOUND;case re.ALREADY_EXISTS:return P.ALREADY_EXISTS;case re.PERMISSION_DENIED:return P.PERMISSION_DENIED;case re.FAILED_PRECONDITION:return P.FAILED_PRECONDITION;case re.ABORTED:return P.ABORTED;case re.OUT_OF_RANGE:return P.OUT_OF_RANGE;case re.UNIMPLEMENTED:return P.UNIMPLEMENTED;case re.DATA_LOSS:return P.DATA_LOSS;default:return x()}}($=re||(re={}))[$.OK=0]="OK",$[$.CANCELLED=1]="CANCELLED",$[$.UNKNOWN=2]="UNKNOWN",$[$.INVALID_ARGUMENT=3]="INVALID_ARGUMENT",$[$.DEADLINE_EXCEEDED=4]="DEADLINE_EXCEEDED",$[$.NOT_FOUND=5]="NOT_FOUND",$[$.ALREADY_EXISTS=6]="ALREADY_EXISTS",$[$.PERMISSION_DENIED=7]="PERMISSION_DENIED",$[$.UNAUTHENTICATED=16]="UNAUTHENTICATED",$[$.RESOURCE_EXHAUSTED=8]="RESOURCE_EXHAUSTED",$[$.FAILED_PRECONDITION=9]="FAILED_PRECONDITION",$[$.ABORTED=10]="ABORTED",$[$.OUT_OF_RANGE=11]="OUT_OF_RANGE",$[$.UNIMPLEMENTED=12]="UNIMPLEMENTED",$[$.INTERNAL=13]="INTERNAL",$[$.UNAVAILABLE=14]="UNAVAILABLE",$[$.DATA_LOSS=15]="DATA_LOSS";/**
 * @license
 * Copyright 2023 Google LLC
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
 */function l_(){return new TextEncoder}/**
 * @license
 * Copyright 2022 Google LLC
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
 */const h_=new Vt([4294967295,4294967295],0);function qc(n){const e=l_().encode(n),t=new ll;return t.update(e),new Uint8Array(t.digest())}function jc(n){const e=new DataView(n.buffer),t=e.getUint32(0,!0),r=e.getUint32(4,!0),i=e.getUint32(8,!0),o=e.getUint32(12,!0);return[new Vt([t,r],0),new Vt([i,o],0)]}class wo{constructor(e,t,r){if(this.bitmap=e,this.padding=t,this.hashCount=r,t<0||t>=8)throw new Qn(`Invalid padding: ${t}`);if(r<0)throw new Qn(`Invalid hash count: ${r}`);if(e.length>0&&this.hashCount===0)throw new Qn(`Invalid hash count: ${r}`);if(e.length===0&&t!==0)throw new Qn(`Invalid padding when bitmap length is 0: ${t}`);this.Ie=8*e.length-t,this.Te=Vt.fromNumber(this.Ie)}Ee(e,t,r){let i=e.add(t.multiply(Vt.fromNumber(r)));return i.compare(h_)===1&&(i=new Vt([i.getBits(0),i.getBits(1)],0)),i.modulo(this.Te).toNumber()}de(e){return(this.bitmap[Math.floor(e/8)]&1<<e%8)!=0}mightContain(e){if(this.Ie===0)return!1;const t=qc(e),[r,i]=jc(t);for(let o=0;o<this.hashCount;o++){const a=this.Ee(r,i,o);if(!this.de(a))return!1}return!0}static create(e,t,r){const i=e%8==0?0:8-e%8,o=new Uint8Array(Math.ceil(e/8)),a=new wo(o,i,t);return r.forEach((u=>a.insert(u))),a}insert(e){if(this.Ie===0)return;const t=qc(e),[r,i]=jc(t);for(let o=0;o<this.hashCount;o++){const a=this.Ee(r,i,o);this.Ae(a)}}Ae(e){const t=Math.floor(e/8),r=e%8;this.bitmap[t]|=1<<r}}class Qn extends Error{constructor(){super(...arguments),this.name="BloomFilterError"}}/**
 * @license
 * Copyright 2017 Google LLC
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
 */class Mi{constructor(e,t,r,i,o){this.snapshotVersion=e,this.targetChanges=t,this.targetMismatches=r,this.documentUpdates=i,this.resolvedLimboDocuments=o}static createSynthesizedRemoteEventForCurrentChange(e,t,r){const i=new Map;return i.set(e,Tr.createSynthesizedTargetChangeForCurrentChange(e,t,r)),new Mi(F.min(),i,new Z(G),ot(),q())}}class Tr{constructor(e,t,r,i,o){this.resumeToken=e,this.current=t,this.addedDocuments=r,this.modifiedDocuments=i,this.removedDocuments=o}static createSynthesizedTargetChangeForCurrentChange(e,t,r){return new Tr(r,t,q(),q(),q())}}/**
 * @license
 * Copyright 2017 Google LLC
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
 */class ii{constructor(e,t,r,i){this.Re=e,this.removedTargetIds=t,this.key=r,this.Ve=i}}class Wl{constructor(e,t){this.targetId=e,this.me=t}}class Gl{constructor(e,t,r=_e.EMPTY_BYTE_STRING,i=null){this.state=e,this.targetIds=t,this.resumeToken=r,this.cause=i}}class $c{constructor(){this.fe=0,this.ge=Wc(),this.pe=_e.EMPTY_BYTE_STRING,this.ye=!1,this.we=!0}get current(){return this.ye}get resumeToken(){return this.pe}get Se(){return this.fe!==0}get be(){return this.we}De(e){e.approximateByteSize()>0&&(this.we=!0,this.pe=e)}Ce(){let e=q(),t=q(),r=q();return this.ge.forEach(((i,o)=>{switch(o){case 0:e=e.add(i);break;case 2:t=t.add(i);break;case 1:r=r.add(i);break;default:x()}})),new Tr(this.pe,this.ye,e,t,r)}ve(){this.we=!1,this.ge=Wc()}Fe(e,t){this.we=!0,this.ge=this.ge.insert(e,t)}Me(e){this.we=!0,this.ge=this.ge.remove(e)}xe(){this.fe+=1}Oe(){this.fe-=1,K(this.fe>=0)}Ne(){this.we=!0,this.ye=!0}}class d_{constructor(e){this.Le=e,this.Be=new Map,this.ke=ot(),this.qe=zc(),this.Qe=new Z(G)}Ke(e){for(const t of e.Re)e.Ve&&e.Ve.isFoundDocument()?this.$e(t,e.Ve):this.Ue(t,e.key,e.Ve);for(const t of e.removedTargetIds)this.Ue(t,e.key,e.Ve)}We(e){this.forEachTarget(e,(t=>{const r=this.Ge(t);switch(e.state){case 0:this.ze(t)&&r.De(e.resumeToken);break;case 1:r.Oe(),r.Se||r.ve(),r.De(e.resumeToken);break;case 2:r.Oe(),r.Se||this.removeTarget(t);break;case 3:this.ze(t)&&(r.Ne(),r.De(e.resumeToken));break;case 4:this.ze(t)&&(this.je(t),r.De(e.resumeToken));break;default:x()}}))}forEachTarget(e,t){e.targetIds.length>0?e.targetIds.forEach(t):this.Be.forEach(((r,i)=>{this.ze(i)&&t(i)}))}He(e){const t=e.targetId,r=e.me.count,i=this.Je(t);if(i){const o=i.target;if(Ws(o))if(r===0){const a=new M(o.path);this.Ue(t,a,ue.newNoDocument(a,F.min()))}else K(r===1);else{const a=this.Ye(t);if(a!==r){const u=this.Ze(e),l=u?this.Xe(u,e,a):1;if(l!==0){this.je(t);const d=l===2?"TargetPurposeExistenceFilterMismatchBloom":"TargetPurposeExistenceFilterMismatch";this.Qe=this.Qe.insert(t,d)}}}}}Ze(e){const t=e.me.unchangedNames;if(!t||!t.bits)return null;const{bits:{bitmap:r="",padding:i=0},hashCount:o=0}=t;let a,u;try{a=Ft(r).toUint8Array()}catch(l){if(l instanceof El)return xt("Decoding the base64 bloom filter in existence filter failed ("+l.message+"); ignoring the bloom filter and falling back to full re-query."),null;throw l}try{u=new wo(a,i,o)}catch(l){return xt(l instanceof Qn?"BloomFilter error: ":"Applying bloom filter failed: ",l),null}return u.Ie===0?null:u}Xe(e,t,r){return t.me.count===r-this.nt(e,t.targetId)?0:2}nt(e,t){const r=this.Le.getRemoteKeysForTarget(t);let i=0;return r.forEach((o=>{const a=this.Le.tt(),u=`projects/${a.projectId}/databases/${a.database}/documents/${o.path.canonicalString()}`;e.mightContain(u)||(this.Ue(t,o,null),i++)})),i}rt(e){const t=new Map;this.Be.forEach(((o,a)=>{const u=this.Je(a);if(u){if(o.current&&Ws(u.target)){const l=new M(u.target.path);this.ke.get(l)!==null||this.it(a,l)||this.Ue(a,l,ue.newNoDocument(l,e))}o.be&&(t.set(a,o.Ce()),o.ve())}}));let r=q();this.qe.forEach(((o,a)=>{let u=!0;a.forEachWhile((l=>{const d=this.Je(l);return!d||d.purpose==="TargetPurposeLimboResolution"||(u=!1,!1)})),u&&(r=r.add(o))})),this.ke.forEach(((o,a)=>a.setReadTime(e)));const i=new Mi(e,t,this.Qe,this.ke,r);return this.ke=ot(),this.qe=zc(),this.Qe=new Z(G),i}$e(e,t){if(!this.ze(e))return;const r=this.it(e,t.key)?2:0;this.Ge(e).Fe(t.key,r),this.ke=this.ke.insert(t.key,t),this.qe=this.qe.insert(t.key,this.st(t.key).add(e))}Ue(e,t,r){if(!this.ze(e))return;const i=this.Ge(e);this.it(e,t)?i.Fe(t,1):i.Me(t),this.qe=this.qe.insert(t,this.st(t).delete(e)),r&&(this.ke=this.ke.insert(t,r))}removeTarget(e){this.Be.delete(e)}Ye(e){const t=this.Ge(e).Ce();return this.Le.getRemoteKeysForTarget(e).size+t.addedDocuments.size-t.removedDocuments.size}xe(e){this.Ge(e).xe()}Ge(e){let t=this.Be.get(e);return t||(t=new $c,this.Be.set(e,t)),t}st(e){let t=this.qe.get(e);return t||(t=new pe(G),this.qe=this.qe.insert(e,t)),t}ze(e){const t=this.Je(e)!==null;return t||O("WatchChangeAggregator","Detected inactive target",e),t}Je(e){const t=this.Be.get(e);return t&&t.Se?null:this.Le.ot(e)}je(e){this.Be.set(e,new $c),this.Le.getRemoteKeysForTarget(e).forEach((t=>{this.Ue(e,t,null)}))}it(e,t){return this.Le.getRemoteKeysForTarget(e).has(t)}}function zc(){return new Z(M.comparator)}function Wc(){return new Z(M.comparator)}const f_={asc:"ASCENDING",desc:"DESCENDING"},p_={"<":"LESS_THAN","<=":"LESS_THAN_OR_EQUAL",">":"GREATER_THAN",">=":"GREATER_THAN_OR_EQUAL","==":"EQUAL","!=":"NOT_EQUAL","array-contains":"ARRAY_CONTAINS",in:"IN","not-in":"NOT_IN","array-contains-any":"ARRAY_CONTAINS_ANY"},m_={and:"AND",or:"OR"};class g_{constructor(e,t){this.databaseId=e,this.useProto3Json=t}}function Hs(n,e){return n.useProto3Json||vr(e)?e:{value:e}}function mi(n,e){return n.useProto3Json?`${new Date(1e3*e.seconds).toISOString().replace(/\.\d*/,"").replace("Z","")}.${("000000000"+e.nanoseconds).slice(-9)}Z`:{seconds:""+e.seconds,nanos:e.nanoseconds}}function Hl(n,e){return n.useProto3Json?e.toBase64():e.toUint8Array()}function __(n,e){return mi(n,e.toTimestamp())}function ke(n){return K(!!n),F.fromTimestamp((function(t){const r=It(t);return new ae(r.seconds,r.nanos)})(n))}function Ao(n,e){return Ks(n,e).canonicalString()}function Ks(n,e){const t=(function(i){return new Y(["projects",i.projectId,"databases",i.database])})(n).child("documents");return e===void 0?t:t.child(e)}function Kl(n){const e=Y.fromString(n);return K(eh(e)),e}function gi(n,e){return Ao(n.databaseId,e.path)}function tr(n,e){const t=Kl(e);if(t.get(1)!==n.databaseId.projectId)throw new b(P.INVALID_ARGUMENT,"Tried to deserialize key from different project: "+t.get(1)+" vs "+n.databaseId.projectId);if(t.get(3)!==n.databaseId.database)throw new b(P.INVALID_ARGUMENT,"Tried to deserialize key from different database: "+t.get(3)+" vs "+n.databaseId.database);return new M(Yl(t))}function Ql(n,e){return Ao(n.databaseId,e)}function y_(n){const e=Kl(n);return e.length===4?Y.emptyPath():Yl(e)}function Qs(n){return new Y(["projects",n.databaseId.projectId,"databases",n.databaseId.database]).canonicalString()}function Yl(n){return K(n.length>4&&n.get(4)==="documents"),n.popFirst(5)}function Gc(n,e,t){return{name:gi(n,e),fields:t.value.mapValue.fields}}function v_(n,e){return"found"in e?(function(r,i){K(!!i.found),i.found.name,i.found.updateTime;const o=tr(r,i.found.name),a=ke(i.found.updateTime),u=i.found.createTime?ke(i.found.createTime):F.min(),l=new Pe({mapValue:{fields:i.found.fields}});return ue.newFoundDocument(o,a,u,l)})(n,e):"missing"in e?(function(r,i){K(!!i.missing),K(!!i.readTime);const o=tr(r,i.missing),a=ke(i.readTime);return ue.newNoDocument(o,a)})(n,e):x()}function E_(n,e){let t;if("targetChange"in e){e.targetChange;const r=(function(d){return d==="NO_CHANGE"?0:d==="ADD"?1:d==="REMOVE"?2:d==="CURRENT"?3:d==="RESET"?4:x()})(e.targetChange.targetChangeType||"NO_CHANGE"),i=e.targetChange.targetIds||[],o=(function(d,p){return d.useProto3Json?(K(p===void 0||typeof p=="string"),_e.fromBase64String(p||"")):(K(p===void 0||p instanceof Buffer||p instanceof Uint8Array),_e.fromUint8Array(p||new Uint8Array))})(n,e.targetChange.resumeToken),a=e.targetChange.cause,u=a&&(function(d){const p=d.code===void 0?P.UNKNOWN:zl(d.code);return new b(p,d.message||"")})(a);t=new Gl(r,i,o,u||null)}else if("documentChange"in e){e.documentChange;const r=e.documentChange;r.document,r.document.name,r.document.updateTime;const i=tr(n,r.document.name),o=ke(r.document.updateTime),a=r.document.createTime?ke(r.document.createTime):F.min(),u=new Pe({mapValue:{fields:r.document.fields}}),l=ue.newFoundDocument(i,o,a,u),d=r.targetIds||[],p=r.removedTargetIds||[];t=new ii(d,p,l.key,l)}else if("documentDelete"in e){e.documentDelete;const r=e.documentDelete;r.document;const i=tr(n,r.document),o=r.readTime?ke(r.readTime):F.min(),a=ue.newNoDocument(i,o),u=r.removedTargetIds||[];t=new ii([],u,a.key,a)}else if("documentRemove"in e){e.documentRemove;const r=e.documentRemove;r.document;const i=tr(n,r.document),o=r.removedTargetIds||[];t=new ii([],o,i,null)}else{if(!("filter"in e))return x();{e.filter;const r=e.filter;r.targetId;const{count:i=0,unchangedNames:o}=r,a=new u_(i,o),u=r.targetId;t=new Wl(u,a)}}return t}function Xl(n,e){let t;if(e instanceof Er)t={update:Gc(n,e.key,e.value)};else if(e instanceof Ir)t={delete:gi(n,e.key)};else if(e instanceof At)t={update:Gc(n,e.key,e.data),updateMask:b_(e.fieldMask)};else{if(!(e instanceof jl))return x();t={verify:gi(n,e.key)}}return e.fieldTransforms.length>0&&(t.updateTransforms=e.fieldTransforms.map((r=>(function(o,a){const u=a.transform;if(u instanceof ur)return{fieldPath:a.field.canonicalString(),setToServerValue:"REQUEST_TIME"};if(u instanceof mn)return{fieldPath:a.field.canonicalString(),appendMissingElements:{values:u.elements}};if(u instanceof lr)return{fieldPath:a.field.canonicalString(),removeAllFromArray:{values:u.elements}};if(u instanceof hr)return{fieldPath:a.field.canonicalString(),increment:u.Pe};throw x()})(0,r)))),e.precondition.isNone||(t.currentDocument=(function(i,o){return o.updateTime!==void 0?{updateTime:__(i,o.updateTime)}:o.exists!==void 0?{exists:o.exists}:x()})(n,e.precondition)),t}function I_(n,e){return n&&n.length>0?(K(e!==void 0),n.map((t=>(function(i,o){let a=i.updateTime?ke(i.updateTime):ke(o);return a.isEqual(F.min())&&(a=ke(o)),new i_(a,i.transformResults||[])})(t,e)))):[]}function T_(n,e){return{documents:[Ql(n,e.path)]}}function w_(n,e){const t={structuredQuery:{}},r=e.path;let i;e.collectionGroup!==null?(i=r,t.structuredQuery.from=[{collectionId:e.collectionGroup,allDescendants:!0}]):(i=r.popLast(),t.structuredQuery.from=[{collectionId:r.lastSegment()}]),t.parent=Ql(n,i);const o=(function(d){if(d.length!==0)return Zl(Le.create(d,"and"))})(e.filters);o&&(t.structuredQuery.where=o);const a=(function(d){if(d.length!==0)return d.map((p=>(function(T){return{field:Zt(T.field),direction:P_(T.dir)}})(p)))})(e.orderBy);a&&(t.structuredQuery.orderBy=a);const u=Hs(n,e.limit);return u!==null&&(t.structuredQuery.limit=u),e.startAt&&(t.structuredQuery.startAt=(function(d){return{before:d.inclusive,values:d.position}})(e.startAt)),e.endAt&&(t.structuredQuery.endAt=(function(d){return{before:!d.inclusive,values:d.position}})(e.endAt)),{_t:t,parent:i}}function A_(n){let e=y_(n.parent);const t=n.structuredQuery,r=t.from?t.from.length:0;let i=null;if(r>0){K(r===1);const p=t.from[0];p.allDescendants?i=p.collectionId:e=e.child(p.collectionId)}let o=[];t.where&&(o=(function(y){const T=Jl(y);return T instanceof Le&&Al(T)?T.getFilters():[T]})(t.where));let a=[];t.orderBy&&(a=(function(y){return y.map((T=>(function(V){return new cr(en(V.field),(function(k){switch(k){case"ASCENDING":return"asc";case"DESCENDING":return"desc";default:return}})(V.direction))})(T)))})(t.orderBy));let u=null;t.limit&&(u=(function(y){let T;return T=typeof y=="object"?y.value:y,vr(T)?null:T})(t.limit));let l=null;t.startAt&&(l=(function(y){const T=!!y.before,S=y.values||[];return new pn(S,T)})(t.startAt));let d=null;return t.endAt&&(d=(function(y){const T=!y.before,S=y.values||[];return new pn(S,T)})(t.endAt)),Gg(e,i,a,o,u,"F",l,d)}function R_(n,e){const t=(function(i){switch(i){case"TargetPurposeListen":return null;case"TargetPurposeExistenceFilterMismatch":return"existence-filter-mismatch";case"TargetPurposeExistenceFilterMismatchBloom":return"existence-filter-mismatch-bloom";case"TargetPurposeLimboResolution":return"limbo-document";default:return x()}})(e.purpose);return t==null?null:{"goog-listen-tags":t}}function Jl(n){return n.unaryFilter!==void 0?(function(t){switch(t.unaryFilter.op){case"IS_NAN":const r=en(t.unaryFilter.field);return se.create(r,"==",{doubleValue:NaN});case"IS_NULL":const i=en(t.unaryFilter.field);return se.create(i,"==",{nullValue:"NULL_VALUE"});case"IS_NOT_NAN":const o=en(t.unaryFilter.field);return se.create(o,"!=",{doubleValue:NaN});case"IS_NOT_NULL":const a=en(t.unaryFilter.field);return se.create(a,"!=",{nullValue:"NULL_VALUE"});default:return x()}})(n):n.fieldFilter!==void 0?(function(t){return se.create(en(t.fieldFilter.field),(function(i){switch(i){case"EQUAL":return"==";case"NOT_EQUAL":return"!=";case"GREATER_THAN":return">";case"GREATER_THAN_OR_EQUAL":return">=";case"LESS_THAN":return"<";case"LESS_THAN_OR_EQUAL":return"<=";case"ARRAY_CONTAINS":return"array-contains";case"IN":return"in";case"NOT_IN":return"not-in";case"ARRAY_CONTAINS_ANY":return"array-contains-any";default:return x()}})(t.fieldFilter.op),t.fieldFilter.value)})(n):n.compositeFilter!==void 0?(function(t){return Le.create(t.compositeFilter.filters.map((r=>Jl(r))),(function(i){switch(i){case"AND":return"and";case"OR":return"or";default:return x()}})(t.compositeFilter.op))})(n):x()}function P_(n){return f_[n]}function S_(n){return p_[n]}function C_(n){return m_[n]}function Zt(n){return{fieldPath:n.canonicalString()}}function en(n){return le.fromServerFormat(n.fieldPath)}function Zl(n){return n instanceof se?(function(t){if(t.op==="=="){if(Vc(t.value))return{unaryFilter:{field:Zt(t.field),op:"IS_NAN"}};if(Dc(t.value))return{unaryFilter:{field:Zt(t.field),op:"IS_NULL"}}}else if(t.op==="!="){if(Vc(t.value))return{unaryFilter:{field:Zt(t.field),op:"IS_NOT_NAN"}};if(Dc(t.value))return{unaryFilter:{field:Zt(t.field),op:"IS_NOT_NULL"}}}return{fieldFilter:{field:Zt(t.field),op:S_(t.op),value:t.value}}})(n):n instanceof Le?(function(t){const r=t.getFilters().map((i=>Zl(i)));return r.length===1?r[0]:{compositeFilter:{op:C_(t.op),filters:r}}})(n):x()}function b_(n){const e=[];return n.fields.forEach((t=>e.push(t.canonicalString()))),{fieldPaths:e}}function eh(n){return n.length>=4&&n.get(0)==="projects"&&n.get(2)==="databases"}/**
 * @license
 * Copyright 2017 Google LLC
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
 */class mt{constructor(e,t,r,i,o=F.min(),a=F.min(),u=_e.EMPTY_BYTE_STRING,l=null){this.target=e,this.targetId=t,this.purpose=r,this.sequenceNumber=i,this.snapshotVersion=o,this.lastLimboFreeSnapshotVersion=a,this.resumeToken=u,this.expectedCount=l}withSequenceNumber(e){return new mt(this.target,this.targetId,this.purpose,e,this.snapshotVersion,this.lastLimboFreeSnapshotVersion,this.resumeToken,this.expectedCount)}withResumeToken(e,t){return new mt(this.target,this.targetId,this.purpose,this.sequenceNumber,t,this.lastLimboFreeSnapshotVersion,e,null)}withExpectedCount(e){return new mt(this.target,this.targetId,this.purpose,this.sequenceNumber,this.snapshotVersion,this.lastLimboFreeSnapshotVersion,this.resumeToken,e)}withLastLimboFreeSnapshotVersion(e){return new mt(this.target,this.targetId,this.purpose,this.sequenceNumber,this.snapshotVersion,e,this.resumeToken,this.expectedCount)}}/**
 * @license
 * Copyright 2017 Google LLC
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
 */class k_{constructor(e){this.ct=e}}function D_(n){const e=A_({parent:n.parent,structuredQuery:n.structuredQuery});return n.limitType==="LAST"?pi(e,e.limit,"L"):e}/**
 * @license
 * Copyright 2019 Google LLC
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
 */class V_{constructor(){this._n=new N_}addToCollectionParentIndex(e,t){return this._n.add(t),C.resolve()}getCollectionParents(e,t){return C.resolve(this._n.getEntries(t))}addFieldIndex(e,t){return C.resolve()}deleteFieldIndex(e,t){return C.resolve()}deleteAllFieldIndexes(e){return C.resolve()}createTargetIndexes(e,t){return C.resolve()}getDocumentsMatchingTarget(e,t){return C.resolve(null)}getIndexType(e,t){return C.resolve(0)}getFieldIndexes(e,t){return C.resolve([])}getNextCollectionGroupToUpdate(e){return C.resolve(null)}getMinOffset(e,t){return C.resolve(Et.min())}getMinOffsetFromCollectionGroup(e,t){return C.resolve(Et.min())}updateCollectionGroup(e,t,r){return C.resolve()}updateIndexEntries(e,t){return C.resolve()}}class N_{constructor(){this.index={}}add(e){const t=e.lastSegment(),r=e.popLast(),i=this.index[t]||new pe(Y.comparator),o=!i.has(r);return this.index[t]=i.add(r),o}has(e){const t=e.lastSegment(),r=e.popLast(),i=this.index[t];return i&&i.has(r)}getEntries(e){return(this.index[e]||new pe(Y.comparator)).toArray()}}/**
 * @license
 * Copyright 2017 Google LLC
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
 */class gn{constructor(e){this.On=e}next(){return this.On+=2,this.On}static Nn(){return new gn(0)}static Ln(){return new gn(-1)}}/**
 * @license
 * Copyright 2017 Google LLC
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
 */class O_{constructor(){this.changes=new Tn((e=>e.toString()),((e,t)=>e.isEqual(t))),this.changesApplied=!1}addEntry(e){this.assertNotApplied(),this.changes.set(e.key,e)}removeEntry(e,t){this.assertNotApplied(),this.changes.set(e,ue.newInvalidDocument(e).setReadTime(t))}getEntry(e,t){this.assertNotApplied();const r=this.changes.get(t);return r!==void 0?C.resolve(r):this.getFromCache(e,t)}getEntries(e,t){return this.getAllFromCache(e,t)}apply(e){return this.assertNotApplied(),this.changesApplied=!0,this.applyChanges(e)}assertNotApplied(){}}/**
 * @license
 * Copyright 2017 Google LLC
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
 *//**
 * @license
 * Copyright 2022 Google LLC
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
 */class M_{constructor(e,t){this.overlayedDocument=e,this.mutatedFields=t}}/**
 * @license
 * Copyright 2017 Google LLC
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
 */class L_{constructor(e,t,r,i){this.remoteDocumentCache=e,this.mutationQueue=t,this.documentOverlayCache=r,this.indexManager=i}getDocument(e,t){let r=null;return this.documentOverlayCache.getOverlay(e,t).next((i=>(r=i,this.remoteDocumentCache.getEntry(e,t)))).next((i=>(r!==null&&er(r.mutation,i,be.empty(),ae.now()),i)))}getDocuments(e,t){return this.remoteDocumentCache.getEntries(e,t).next((r=>this.getLocalViewOfDocuments(e,r,q()).next((()=>r))))}getLocalViewOfDocuments(e,t,r=q()){const i=kt();return this.populateOverlays(e,i,t).next((()=>this.computeViews(e,t,i,r).next((o=>{let a=Kn();return o.forEach(((u,l)=>{a=a.insert(u,l.overlayedDocument)})),a}))))}getOverlayedDocuments(e,t){const r=kt();return this.populateOverlays(e,r,t).next((()=>this.computeViews(e,t,r,q())))}populateOverlays(e,t,r){const i=[];return r.forEach((o=>{t.has(o)||i.push(o)})),this.documentOverlayCache.getOverlays(e,i).next((o=>{o.forEach(((a,u)=>{t.set(a,u)}))}))}computeViews(e,t,r,i){let o=ot();const a=Zn(),u=(function(){return Zn()})();return t.forEach(((l,d)=>{const p=r.get(d.key);i.has(d.key)&&(p===void 0||p.mutation instanceof At)?o=o.insert(d.key,d):p!==void 0?(a.set(d.key,p.mutation.getFieldMask()),er(p.mutation,d,p.mutation.getFieldMask(),ae.now())):a.set(d.key,be.empty())})),this.recalculateAndSaveOverlays(e,o).next((l=>(l.forEach(((d,p)=>a.set(d,p))),t.forEach(((d,p)=>{var y;return u.set(d,new M_(p,(y=a.get(d))!==null&&y!==void 0?y:null))})),u)))}recalculateAndSaveOverlays(e,t){const r=Zn();let i=new Z(((a,u)=>a-u)),o=q();return this.mutationQueue.getAllMutationBatchesAffectingDocumentKeys(e,t).next((a=>{for(const u of a)u.keys().forEach((l=>{const d=t.get(l);if(d===null)return;let p=r.get(l)||be.empty();p=u.applyToLocalView(d,p),r.set(l,p);const y=(i.get(u.batchId)||q()).add(l);i=i.insert(u.batchId,y)}))})).next((()=>{const a=[],u=i.getReverseIterator();for(;u.hasNext();){const l=u.getNext(),d=l.key,p=l.value,y=Vl();p.forEach((T=>{if(!o.has(T)){const S=Bl(t.get(T),r.get(T));S!==null&&y.set(T,S),o=o.add(T)}})),a.push(this.documentOverlayCache.saveOverlays(e,d,y))}return C.waitFor(a)})).next((()=>r))}recalculateAndSaveOverlaysForDocumentKeys(e,t){return this.remoteDocumentCache.getEntries(e,t).next((r=>this.recalculateAndSaveOverlays(e,r)))}getDocumentsMatchingQuery(e,t,r,i){return(function(a){return M.isDocumentKey(a.path)&&a.collectionGroup===null&&a.filters.length===0})(t)?this.getDocumentsMatchingDocumentQuery(e,t.path):Eo(t)?this.getDocumentsMatchingCollectionGroupQuery(e,t,r,i):this.getDocumentsMatchingCollectionQuery(e,t,r,i)}getNextDocuments(e,t,r,i){return this.remoteDocumentCache.getAllFromCollectionGroup(e,t,r,i).next((o=>{const a=i-o.size>0?this.documentOverlayCache.getOverlaysForCollectionGroup(e,t,r.largestBatchId,i-o.size):C.resolve(kt());let u=-1,l=o;return a.next((d=>C.forEach(d,((p,y)=>(u<y.largestBatchId&&(u=y.largestBatchId),o.get(p)?C.resolve():this.remoteDocumentCache.getEntry(e,p).next((T=>{l=l.insert(p,T)}))))).next((()=>this.populateOverlays(e,d,o))).next((()=>this.computeViews(e,l,d,q()))).next((p=>({batchId:u,changes:Dl(p)})))))}))}getDocumentsMatchingDocumentQuery(e,t){return this.getDocument(e,new M(t)).next((r=>{let i=Kn();return r.isFoundDocument()&&(i=i.insert(r.key,r)),i}))}getDocumentsMatchingCollectionGroupQuery(e,t,r,i){const o=t.collectionGroup;let a=Kn();return this.indexManager.getCollectionParents(e,o).next((u=>C.forEach(u,(l=>{const d=(function(y,T){return new jt(T,null,y.explicitOrderBy.slice(),y.filters.slice(),y.limit,y.limitType,y.startAt,y.endAt)})(t,l.child(o));return this.getDocumentsMatchingCollectionQuery(e,d,r,i).next((p=>{p.forEach(((y,T)=>{a=a.insert(y,T)}))}))})).next((()=>a))))}getDocumentsMatchingCollectionQuery(e,t,r,i){let o;return this.documentOverlayCache.getOverlaysForCollection(e,t.path,r.largestBatchId).next((a=>(o=a,this.remoteDocumentCache.getDocumentsMatchingQuery(e,t,r,o,i)))).next((a=>{o.forEach(((l,d)=>{const p=d.getKey();a.get(p)===null&&(a=a.insert(p,ue.newInvalidDocument(p)))}));let u=Kn();return a.forEach(((l,d)=>{const p=o.get(l);p!==void 0&&er(p.mutation,d,be.empty(),ae.now()),Vi(t,d)&&(u=u.insert(l,d))})),u}))}}/**
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
 */class x_{constructor(e){this.serializer=e,this.cr=new Map,this.lr=new Map}getBundleMetadata(e,t){return C.resolve(this.cr.get(t))}saveBundleMetadata(e,t){return this.cr.set(t.id,(function(i){return{id:i.id,version:i.version,createTime:ke(i.createTime)}})(t)),C.resolve()}getNamedQuery(e,t){return C.resolve(this.lr.get(t))}saveNamedQuery(e,t){return this.lr.set(t.name,(function(i){return{name:i.name,query:D_(i.bundledQuery),readTime:ke(i.readTime)}})(t)),C.resolve()}}/**
 * @license
 * Copyright 2022 Google LLC
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
 */class F_{constructor(){this.overlays=new Z(M.comparator),this.hr=new Map}getOverlay(e,t){return C.resolve(this.overlays.get(t))}getOverlays(e,t){const r=kt();return C.forEach(t,(i=>this.getOverlay(e,i).next((o=>{o!==null&&r.set(i,o)})))).next((()=>r))}saveOverlays(e,t,r){return r.forEach(((i,o)=>{this.ht(e,t,o)})),C.resolve()}removeOverlaysForBatchId(e,t,r){const i=this.hr.get(r);return i!==void 0&&(i.forEach((o=>this.overlays=this.overlays.remove(o))),this.hr.delete(r)),C.resolve()}getOverlaysForCollection(e,t,r){const i=kt(),o=t.length+1,a=new M(t.child("")),u=this.overlays.getIteratorFrom(a);for(;u.hasNext();){const l=u.getNext().value,d=l.getKey();if(!t.isPrefixOf(d.path))break;d.path.length===o&&l.largestBatchId>r&&i.set(l.getKey(),l)}return C.resolve(i)}getOverlaysForCollectionGroup(e,t,r,i){let o=new Z(((d,p)=>d-p));const a=this.overlays.getIterator();for(;a.hasNext();){const d=a.getNext().value;if(d.getKey().getCollectionGroup()===t&&d.largestBatchId>r){let p=o.get(d.largestBatchId);p===null&&(p=kt(),o=o.insert(d.largestBatchId,p)),p.set(d.getKey(),d)}}const u=kt(),l=o.getIterator();for(;l.hasNext()&&(l.getNext().value.forEach(((d,p)=>u.set(d,p))),!(u.size()>=i)););return C.resolve(u)}ht(e,t,r){const i=this.overlays.get(r.key);if(i!==null){const a=this.hr.get(i.largestBatchId).delete(r.key);this.hr.set(i.largestBatchId,a)}this.overlays=this.overlays.insert(r.key,new c_(t,r));let o=this.hr.get(t);o===void 0&&(o=q(),this.hr.set(t,o)),this.hr.set(t,o.add(r.key))}}/**
 * @license
 * Copyright 2017 Google LLC
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
 */class Ro{constructor(){this.Pr=new pe(ce.Ir),this.Tr=new pe(ce.Er)}isEmpty(){return this.Pr.isEmpty()}addReference(e,t){const r=new ce(e,t);this.Pr=this.Pr.add(r),this.Tr=this.Tr.add(r)}dr(e,t){e.forEach((r=>this.addReference(r,t)))}removeReference(e,t){this.Ar(new ce(e,t))}Rr(e,t){e.forEach((r=>this.removeReference(r,t)))}Vr(e){const t=new M(new Y([])),r=new ce(t,e),i=new ce(t,e+1),o=[];return this.Tr.forEachInRange([r,i],(a=>{this.Ar(a),o.push(a.key)})),o}mr(){this.Pr.forEach((e=>this.Ar(e)))}Ar(e){this.Pr=this.Pr.delete(e),this.Tr=this.Tr.delete(e)}gr(e){const t=new M(new Y([])),r=new ce(t,e),i=new ce(t,e+1);let o=q();return this.Tr.forEachInRange([r,i],(a=>{o=o.add(a.key)})),o}containsKey(e){const t=new ce(e,0),r=this.Pr.firstAfterOrEqual(t);return r!==null&&e.isEqual(r.key)}}class ce{constructor(e,t){this.key=e,this.pr=t}static Ir(e,t){return M.comparator(e.key,t.key)||G(e.pr,t.pr)}static Er(e,t){return G(e.pr,t.pr)||M.comparator(e.key,t.key)}}/**
 * @license
 * Copyright 2017 Google LLC
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
 */class U_{constructor(e,t){this.indexManager=e,this.referenceDelegate=t,this.mutationQueue=[],this.yr=1,this.wr=new pe(ce.Ir)}checkEmpty(e){return C.resolve(this.mutationQueue.length===0)}addMutationBatch(e,t,r,i){const o=this.yr;this.yr++,this.mutationQueue.length>0&&this.mutationQueue[this.mutationQueue.length-1];const a=new a_(o,t,r,i);this.mutationQueue.push(a);for(const u of i)this.wr=this.wr.add(new ce(u.key,o)),this.indexManager.addToCollectionParentIndex(e,u.key.path.popLast());return C.resolve(a)}lookupMutationBatch(e,t){return C.resolve(this.Sr(t))}getNextMutationBatchAfterBatchId(e,t){const r=t+1,i=this.br(r),o=i<0?0:i;return C.resolve(this.mutationQueue.length>o?this.mutationQueue[o]:null)}getHighestUnacknowledgedBatchId(){return C.resolve(this.mutationQueue.length===0?-1:this.yr-1)}getAllMutationBatches(e){return C.resolve(this.mutationQueue.slice())}getAllMutationBatchesAffectingDocumentKey(e,t){const r=new ce(t,0),i=new ce(t,Number.POSITIVE_INFINITY),o=[];return this.wr.forEachInRange([r,i],(a=>{const u=this.Sr(a.pr);o.push(u)})),C.resolve(o)}getAllMutationBatchesAffectingDocumentKeys(e,t){let r=new pe(G);return t.forEach((i=>{const o=new ce(i,0),a=new ce(i,Number.POSITIVE_INFINITY);this.wr.forEachInRange([o,a],(u=>{r=r.add(u.pr)}))})),C.resolve(this.Dr(r))}getAllMutationBatchesAffectingQuery(e,t){const r=t.path,i=r.length+1;let o=r;M.isDocumentKey(o)||(o=o.child(""));const a=new ce(new M(o),0);let u=new pe(G);return this.wr.forEachWhile((l=>{const d=l.key.path;return!!r.isPrefixOf(d)&&(d.length===i&&(u=u.add(l.pr)),!0)}),a),C.resolve(this.Dr(u))}Dr(e){const t=[];return e.forEach((r=>{const i=this.Sr(r);i!==null&&t.push(i)})),t}removeMutationBatch(e,t){K(this.Cr(t.batchId,"removed")===0),this.mutationQueue.shift();let r=this.wr;return C.forEach(t.mutations,(i=>{const o=new ce(i.key,t.batchId);return r=r.delete(o),this.referenceDelegate.markPotentiallyOrphaned(e,i.key)})).next((()=>{this.wr=r}))}Mn(e){}containsKey(e,t){const r=new ce(t,0),i=this.wr.firstAfterOrEqual(r);return C.resolve(t.isEqual(i&&i.key))}performConsistencyCheck(e){return this.mutationQueue.length,C.resolve()}Cr(e,t){return this.br(e)}br(e){return this.mutationQueue.length===0?0:e-this.mutationQueue[0].batchId}Sr(e){const t=this.br(e);return t<0||t>=this.mutationQueue.length?null:this.mutationQueue[t]}}/**
 * @license
 * Copyright 2017 Google LLC
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
 */class B_{constructor(e){this.vr=e,this.docs=(function(){return new Z(M.comparator)})(),this.size=0}setIndexManager(e){this.indexManager=e}addEntry(e,t){const r=t.key,i=this.docs.get(r),o=i?i.size:0,a=this.vr(t);return this.docs=this.docs.insert(r,{document:t.mutableCopy(),size:a}),this.size+=a-o,this.indexManager.addToCollectionParentIndex(e,r.path.popLast())}removeEntry(e){const t=this.docs.get(e);t&&(this.docs=this.docs.remove(e),this.size-=t.size)}getEntry(e,t){const r=this.docs.get(t);return C.resolve(r?r.document.mutableCopy():ue.newInvalidDocument(t))}getEntries(e,t){let r=ot();return t.forEach((i=>{const o=this.docs.get(i);r=r.insert(i,o?o.document.mutableCopy():ue.newInvalidDocument(i))})),C.resolve(r)}getDocumentsMatchingQuery(e,t,r,i){let o=ot();const a=t.path,u=new M(a.child("")),l=this.docs.getIteratorFrom(u);for(;l.hasNext();){const{key:d,value:{document:p}}=l.getNext();if(!a.isPrefixOf(d.path))break;d.path.length>a.length+1||Cg(Sg(p),r)<=0||(i.has(p.key)||Vi(t,p))&&(o=o.insert(p.key,p.mutableCopy()))}return C.resolve(o)}getAllFromCollectionGroup(e,t,r,i){x()}Fr(e,t){return C.forEach(this.docs,(r=>t(r)))}newChangeBuffer(e){return new q_(this)}getSize(e){return C.resolve(this.size)}}class q_ extends O_{constructor(e){super(),this.ar=e}applyChanges(e){const t=[];return this.changes.forEach(((r,i)=>{i.isValidDocument()?t.push(this.ar.addEntry(e,i)):this.ar.removeEntry(r)})),C.waitFor(t)}getFromCache(e,t){return this.ar.getEntry(e,t)}getAllFromCache(e,t){return this.ar.getEntries(e,t)}}/**
 * @license
 * Copyright 2017 Google LLC
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
 */class j_{constructor(e){this.persistence=e,this.Mr=new Tn((t=>yo(t)),vo),this.lastRemoteSnapshotVersion=F.min(),this.highestTargetId=0,this.Or=0,this.Nr=new Ro,this.targetCount=0,this.Lr=gn.Nn()}forEachTarget(e,t){return this.Mr.forEach(((r,i)=>t(i))),C.resolve()}getLastRemoteSnapshotVersion(e){return C.resolve(this.lastRemoteSnapshotVersion)}getHighestSequenceNumber(e){return C.resolve(this.Or)}allocateTargetId(e){return this.highestTargetId=this.Lr.next(),C.resolve(this.highestTargetId)}setTargetsMetadata(e,t,r){return r&&(this.lastRemoteSnapshotVersion=r),t>this.Or&&(this.Or=t),C.resolve()}qn(e){this.Mr.set(e.target,e);const t=e.targetId;t>this.highestTargetId&&(this.Lr=new gn(t),this.highestTargetId=t),e.sequenceNumber>this.Or&&(this.Or=e.sequenceNumber)}addTargetData(e,t){return this.qn(t),this.targetCount+=1,C.resolve()}updateTargetData(e,t){return this.qn(t),C.resolve()}removeTargetData(e,t){return this.Mr.delete(t.target),this.Nr.Vr(t.targetId),this.targetCount-=1,C.resolve()}removeTargets(e,t,r){let i=0;const o=[];return this.Mr.forEach(((a,u)=>{u.sequenceNumber<=t&&r.get(u.targetId)===null&&(this.Mr.delete(a),o.push(this.removeMatchingKeysForTargetId(e,u.targetId)),i++)})),C.waitFor(o).next((()=>i))}getTargetCount(e){return C.resolve(this.targetCount)}getTargetData(e,t){const r=this.Mr.get(t)||null;return C.resolve(r)}addMatchingKeys(e,t,r){return this.Nr.dr(t,r),C.resolve()}removeMatchingKeys(e,t,r){this.Nr.Rr(t,r);const i=this.persistence.referenceDelegate,o=[];return i&&t.forEach((a=>{o.push(i.markPotentiallyOrphaned(e,a))})),C.waitFor(o)}removeMatchingKeysForTargetId(e,t){return this.Nr.Vr(t),C.resolve()}getMatchingKeysForTargetId(e,t){const r=this.Nr.gr(t);return C.resolve(r)}containsKey(e,t){return C.resolve(this.Nr.containsKey(t))}}/**
 * @license
 * Copyright 2017 Google LLC
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
 */class $_{constructor(e,t){this.Br={},this.overlays={},this.kr=new mo(0),this.qr=!1,this.qr=!0,this.referenceDelegate=e(this),this.Qr=new j_(this),this.indexManager=new V_,this.remoteDocumentCache=(function(i){return new B_(i)})((r=>this.referenceDelegate.Kr(r))),this.serializer=new k_(t),this.$r=new x_(this.serializer)}start(){return Promise.resolve()}shutdown(){return this.qr=!1,Promise.resolve()}get started(){return this.qr}setDatabaseDeletedListener(){}setNetworkEnabled(){}getIndexManager(e){return this.indexManager}getDocumentOverlayCache(e){let t=this.overlays[e.toKey()];return t||(t=new F_,this.overlays[e.toKey()]=t),t}getMutationQueue(e,t){let r=this.Br[e.toKey()];return r||(r=new U_(t,this.referenceDelegate),this.Br[e.toKey()]=r),r}getTargetCache(){return this.Qr}getRemoteDocumentCache(){return this.remoteDocumentCache}getBundleCache(){return this.$r}runTransaction(e,t,r){O("MemoryPersistence","Starting transaction:",e);const i=new z_(this.kr.next());return this.referenceDelegate.Ur(),r(i).next((o=>this.referenceDelegate.Wr(i).next((()=>o)))).toPromise().then((o=>(i.raiseOnCommittedEvent(),o)))}Gr(e,t){return C.or(Object.values(this.Br).map((r=>()=>r.containsKey(e,t))))}}class z_ extends kg{constructor(e){super(),this.currentSequenceNumber=e}}class Po{constructor(e){this.persistence=e,this.zr=new Ro,this.jr=null}static Hr(e){return new Po(e)}get Jr(){if(this.jr)return this.jr;throw x()}addReference(e,t,r){return this.zr.addReference(r,t),this.Jr.delete(r.toString()),C.resolve()}removeReference(e,t,r){return this.zr.removeReference(r,t),this.Jr.add(r.toString()),C.resolve()}markPotentiallyOrphaned(e,t){return this.Jr.add(t.toString()),C.resolve()}removeTarget(e,t){this.zr.Vr(t.targetId).forEach((i=>this.Jr.add(i.toString())));const r=this.persistence.getTargetCache();return r.getMatchingKeysForTargetId(e,t.targetId).next((i=>{i.forEach((o=>this.Jr.add(o.toString())))})).next((()=>r.removeTargetData(e,t)))}Ur(){this.jr=new Set}Wr(e){const t=this.persistence.getRemoteDocumentCache().newChangeBuffer();return C.forEach(this.Jr,(r=>{const i=M.fromPath(r);return this.Yr(e,i).next((o=>{o||t.removeEntry(i,F.min())}))})).next((()=>(this.jr=null,t.apply(e))))}updateLimboDocument(e,t){return this.Yr(e,t).next((r=>{r?this.Jr.delete(t.toString()):this.Jr.add(t.toString())}))}Kr(e){return 0}Yr(e,t){return C.or([()=>C.resolve(this.zr.containsKey(t)),()=>this.persistence.getTargetCache().containsKey(e,t),()=>this.persistence.Gr(e,t)])}}/**
 * @license
 * Copyright 2017 Google LLC
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
 */class So{constructor(e,t,r,i){this.targetId=e,this.fromCache=t,this.qi=r,this.Qi=i}static Ki(e,t){let r=q(),i=q();for(const o of t.docChanges)switch(o.type){case 0:r=r.add(o.doc.key);break;case 1:i=i.add(o.doc.key)}return new So(e,t.fromCache,r,i)}}/**
 * @license
 * Copyright 2023 Google LLC
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
 */class W_{constructor(){this._documentReadCount=0}get documentReadCount(){return this._documentReadCount}incrementDocumentReadCount(e){this._documentReadCount+=e}}/**
 * @license
 * Copyright 2019 Google LLC
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
 */class G_{constructor(){this.$i=!1,this.Ui=!1,this.Wi=100,this.Gi=(function(){return Dd()?8:Dg(ge())>0?6:4})()}initialize(e,t){this.zi=e,this.indexManager=t,this.$i=!0}getDocumentsMatchingQuery(e,t,r,i){const o={result:null};return this.ji(e,t).next((a=>{o.result=a})).next((()=>{if(!o.result)return this.Hi(e,t,i,r).next((a=>{o.result=a}))})).next((()=>{if(o.result)return;const a=new W_;return this.Ji(e,t,a).next((u=>{if(o.result=u,this.Ui)return this.Yi(e,t,a,u.size)}))})).next((()=>o.result))}Yi(e,t,r,i){return r.documentReadCount<this.Wi?(zn()<=j.DEBUG&&O("QueryEngine","SDK will not create cache indexes for query:",Jt(t),"since it only creates cache indexes for collection contains","more than or equal to",this.Wi,"documents"),C.resolve()):(zn()<=j.DEBUG&&O("QueryEngine","Query:",Jt(t),"scans",r.documentReadCount,"local documents and returns",i,"documents as results."),r.documentReadCount>this.Gi*i?(zn()<=j.DEBUG&&O("QueryEngine","The SDK decides to create cache indexes for query:",Jt(t),"as using cache indexes may help improve performance."),this.indexManager.createTargetIndexes(e,je(t))):C.resolve())}ji(e,t){if(Lc(t))return C.resolve(null);let r=je(t);return this.indexManager.getIndexType(e,r).next((i=>i===0?null:(t.limit!==null&&i===1&&(t=pi(t,null,"F"),r=je(t)),this.indexManager.getDocumentsMatchingTarget(e,r).next((o=>{const a=q(...o);return this.zi.getDocuments(e,a).next((u=>this.indexManager.getMinOffset(e,r).next((l=>{const d=this.Zi(t,u);return this.Xi(t,d,a,l.readTime)?this.ji(e,pi(t,null,"F")):this.es(e,d,t,l)}))))})))))}Hi(e,t,r,i){return Lc(t)||i.isEqual(F.min())?C.resolve(null):this.zi.getDocuments(e,r).next((o=>{const a=this.Zi(t,o);return this.Xi(t,a,r,i)?C.resolve(null):(zn()<=j.DEBUG&&O("QueryEngine","Re-using previous result from %s to execute query: %s",i.toString(),Jt(t)),this.es(e,a,t,Pg(i,-1)).next((u=>u)))}))}Zi(e,t){let r=new pe(bl(e));return t.forEach(((i,o)=>{Vi(e,o)&&(r=r.add(o))})),r}Xi(e,t,r,i){if(e.limit===null)return!1;if(r.size!==t.size)return!0;const o=e.limitType==="F"?t.last():t.first();return!!o&&(o.hasPendingWrites||o.version.compareTo(i)>0)}Ji(e,t,r){return zn()<=j.DEBUG&&O("QueryEngine","Using full collection scan to execute query:",Jt(t)),this.zi.getDocumentsMatchingQuery(e,t,Et.min(),r)}es(e,t,r,i){return this.zi.getDocumentsMatchingQuery(e,r,i).next((o=>(t.forEach((a=>{o=o.insert(a.key,a)})),o)))}}/**
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
 */class H_{constructor(e,t,r,i){this.persistence=e,this.ts=t,this.serializer=i,this.ns=new Z(G),this.rs=new Tn((o=>yo(o)),vo),this.ss=new Map,this.os=e.getRemoteDocumentCache(),this.Qr=e.getTargetCache(),this.$r=e.getBundleCache(),this._s(r)}_s(e){this.documentOverlayCache=this.persistence.getDocumentOverlayCache(e),this.indexManager=this.persistence.getIndexManager(e),this.mutationQueue=this.persistence.getMutationQueue(e,this.indexManager),this.localDocuments=new L_(this.os,this.mutationQueue,this.documentOverlayCache,this.indexManager),this.os.setIndexManager(this.indexManager),this.ts.initialize(this.localDocuments,this.indexManager)}collectGarbage(e){return this.persistence.runTransaction("Collect garbage","readwrite-primary",(t=>e.collect(t,this.ns)))}}function K_(n,e,t,r){return new H_(n,e,t,r)}async function th(n,e){const t=U(n);return await t.persistence.runTransaction("Handle user change","readonly",(r=>{let i;return t.mutationQueue.getAllMutationBatches(r).next((o=>(i=o,t._s(e),t.mutationQueue.getAllMutationBatches(r)))).next((o=>{const a=[],u=[];let l=q();for(const d of i){a.push(d.batchId);for(const p of d.mutations)l=l.add(p.key)}for(const d of o){u.push(d.batchId);for(const p of d.mutations)l=l.add(p.key)}return t.localDocuments.getDocuments(r,l).next((d=>({us:d,removedBatchIds:a,addedBatchIds:u})))}))}))}function Q_(n,e){const t=U(n);return t.persistence.runTransaction("Acknowledge batch","readwrite-primary",(r=>{const i=e.batch.keys(),o=t.os.newChangeBuffer({trackRemovals:!0});return(function(u,l,d,p){const y=d.batch,T=y.keys();let S=C.resolve();return T.forEach((V=>{S=S.next((()=>p.getEntry(l,V))).next((N=>{const k=d.docVersions.get(V);K(k!==null),N.version.compareTo(k)<0&&(y.applyToRemoteDocument(N,d),N.isValidDocument()&&(N.setReadTime(d.commitVersion),p.addEntry(N)))}))})),S.next((()=>u.mutationQueue.removeMutationBatch(l,y)))})(t,r,e,o).next((()=>o.apply(r))).next((()=>t.mutationQueue.performConsistencyCheck(r))).next((()=>t.documentOverlayCache.removeOverlaysForBatchId(r,i,e.batch.batchId))).next((()=>t.localDocuments.recalculateAndSaveOverlaysForDocumentKeys(r,(function(u){let l=q();for(let d=0;d<u.mutationResults.length;++d)u.mutationResults[d].transformResults.length>0&&(l=l.add(u.batch.mutations[d].key));return l})(e)))).next((()=>t.localDocuments.getDocuments(r,i)))}))}function nh(n){const e=U(n);return e.persistence.runTransaction("Get last remote snapshot version","readonly",(t=>e.Qr.getLastRemoteSnapshotVersion(t)))}function Y_(n,e){const t=U(n),r=e.snapshotVersion;let i=t.ns;return t.persistence.runTransaction("Apply remote event","readwrite-primary",(o=>{const a=t.os.newChangeBuffer({trackRemovals:!0});i=t.ns;const u=[];e.targetChanges.forEach(((p,y)=>{const T=i.get(y);if(!T)return;u.push(t.Qr.removeMatchingKeys(o,p.removedDocuments,y).next((()=>t.Qr.addMatchingKeys(o,p.addedDocuments,y))));let S=T.withSequenceNumber(o.currentSequenceNumber);e.targetMismatches.get(y)!==null?S=S.withResumeToken(_e.EMPTY_BYTE_STRING,F.min()).withLastLimboFreeSnapshotVersion(F.min()):p.resumeToken.approximateByteSize()>0&&(S=S.withResumeToken(p.resumeToken,r)),i=i.insert(y,S),(function(N,k,B){return N.resumeToken.approximateByteSize()===0||k.snapshotVersion.toMicroseconds()-N.snapshotVersion.toMicroseconds()>=3e8?!0:B.addedDocuments.size+B.modifiedDocuments.size+B.removedDocuments.size>0})(T,S,p)&&u.push(t.Qr.updateTargetData(o,S))}));let l=ot(),d=q();if(e.documentUpdates.forEach((p=>{e.resolvedLimboDocuments.has(p)&&u.push(t.persistence.referenceDelegate.updateLimboDocument(o,p))})),u.push(X_(o,a,e.documentUpdates).next((p=>{l=p.cs,d=p.ls}))),!r.isEqual(F.min())){const p=t.Qr.getLastRemoteSnapshotVersion(o).next((y=>t.Qr.setTargetsMetadata(o,o.currentSequenceNumber,r)));u.push(p)}return C.waitFor(u).next((()=>a.apply(o))).next((()=>t.localDocuments.getLocalViewOfDocuments(o,l,d))).next((()=>l))})).then((o=>(t.ns=i,o)))}function X_(n,e,t){let r=q(),i=q();return t.forEach((o=>r=r.add(o))),e.getEntries(n,r).next((o=>{let a=ot();return t.forEach(((u,l)=>{const d=o.get(u);l.isFoundDocument()!==d.isFoundDocument()&&(i=i.add(u)),l.isNoDocument()&&l.version.isEqual(F.min())?(e.removeEntry(u,l.readTime),a=a.insert(u,l)):!d.isValidDocument()||l.version.compareTo(d.version)>0||l.version.compareTo(d.version)===0&&d.hasPendingWrites?(e.addEntry(l),a=a.insert(u,l)):O("LocalStore","Ignoring outdated watch update for ",u,". Current version:",d.version," Watch version:",l.version)})),{cs:a,ls:i}}))}function J_(n,e){const t=U(n);return t.persistence.runTransaction("Get next mutation batch","readonly",(r=>(e===void 0&&(e=-1),t.mutationQueue.getNextMutationBatchAfterBatchId(r,e))))}function Z_(n,e){const t=U(n);return t.persistence.runTransaction("Allocate target","readwrite",(r=>{let i;return t.Qr.getTargetData(r,e).next((o=>o?(i=o,C.resolve(i)):t.Qr.allocateTargetId(r).next((a=>(i=new mt(e,a,"TargetPurposeListen",r.currentSequenceNumber),t.Qr.addTargetData(r,i).next((()=>i)))))))})).then((r=>{const i=t.ns.get(r.targetId);return(i===null||r.snapshotVersion.compareTo(i.snapshotVersion)>0)&&(t.ns=t.ns.insert(r.targetId,r),t.rs.set(e,r.targetId)),r}))}async function Ys(n,e,t){const r=U(n),i=r.ns.get(e),o=t?"readwrite":"readwrite-primary";try{t||await r.persistence.runTransaction("Release target",o,(a=>r.persistence.referenceDelegate.removeTarget(a,i)))}catch(a){if(!yr(a))throw a;O("LocalStore",`Failed to update sequence numbers for target ${e}: ${a}`)}r.ns=r.ns.remove(e),r.rs.delete(i.target)}function Hc(n,e,t){const r=U(n);let i=F.min(),o=q();return r.persistence.runTransaction("Execute query","readwrite",(a=>(function(l,d,p){const y=U(l),T=y.rs.get(p);return T!==void 0?C.resolve(y.ns.get(T)):y.Qr.getTargetData(d,p)})(r,a,je(e)).next((u=>{if(u)return i=u.lastLimboFreeSnapshotVersion,r.Qr.getMatchingKeysForTargetId(a,u.targetId).next((l=>{o=l}))})).next((()=>r.ts.getDocumentsMatchingQuery(a,e,t?i:F.min(),t?o:q()))).next((u=>(ey(r,Kg(e),u),{documents:u,hs:o})))))}function ey(n,e,t){let r=n.ss.get(e)||F.min();t.forEach(((i,o)=>{o.readTime.compareTo(r)>0&&(r=o.readTime)})),n.ss.set(e,r)}class Kc{constructor(){this.activeTargetIds=e_()}As(e){this.activeTargetIds=this.activeTargetIds.add(e)}Rs(e){this.activeTargetIds=this.activeTargetIds.delete(e)}ds(){const e={activeTargetIds:this.activeTargetIds.toArray(),updateTimeMs:Date.now()};return JSON.stringify(e)}}class ty{constructor(){this.no=new Kc,this.ro={},this.onlineStateHandler=null,this.sequenceNumberHandler=null}addPendingMutation(e){}updateMutationState(e,t,r){}addLocalQueryTarget(e){return this.no.As(e),this.ro[e]||"not-current"}updateQueryState(e,t,r){this.ro[e]=t}removeLocalQueryTarget(e){this.no.Rs(e)}isLocalQueryTarget(e){return this.no.activeTargetIds.has(e)}clearQueryState(e){delete this.ro[e]}getAllActiveQueryTargets(){return this.no.activeTargetIds}isActiveQueryTarget(e){return this.no.activeTargetIds.has(e)}start(){return this.no=new Kc,Promise.resolve()}handleUserChange(e,t,r){}setOnlineState(e){}shutdown(){}writeSequenceNumber(e){}notifyBundleLoaded(e){}}/**
 * @license
 * Copyright 2019 Google LLC
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
 */class ny{io(e){}shutdown(){}}/**
 * @license
 * Copyright 2019 Google LLC
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
 */class Qc{constructor(){this.so=()=>this.oo(),this._o=()=>this.ao(),this.uo=[],this.co()}io(e){this.uo.push(e)}shutdown(){window.removeEventListener("online",this.so),window.removeEventListener("offline",this._o)}co(){window.addEventListener("online",this.so),window.addEventListener("offline",this._o)}oo(){O("ConnectivityMonitor","Network connectivity changed: AVAILABLE");for(const e of this.uo)e(0)}ao(){O("ConnectivityMonitor","Network connectivity changed: UNAVAILABLE");for(const e of this.uo)e(1)}static D(){return typeof window<"u"&&window.addEventListener!==void 0&&window.removeEventListener!==void 0}}/**
 * @license
 * Copyright 2023 Google LLC
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
 */let Yr=null;function bs(){return Yr===null?Yr=(function(){return 268435456+Math.round(2147483648*Math.random())})():Yr++,"0x"+Yr.toString(16)}/**
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
 */const ry={BatchGetDocuments:"batchGet",Commit:"commit",RunQuery:"runQuery",RunAggregationQuery:"runAggregationQuery"};/**
 * @license
 * Copyright 2017 Google LLC
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
 */class iy{constructor(e){this.lo=e.lo,this.ho=e.ho}Po(e){this.Io=e}To(e){this.Eo=e}Ao(e){this.Ro=e}onMessage(e){this.Vo=e}close(){this.ho()}send(e){this.lo(e)}mo(){this.Io()}fo(){this.Eo()}po(e){this.Ro(e)}yo(e){this.Vo(e)}}/**
 * @license
 * Copyright 2017 Google LLC
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
 */const Te="WebChannelConnection";class sy extends class{constructor(t){this.databaseInfo=t,this.databaseId=t.databaseId;const r=t.ssl?"https":"http",i=encodeURIComponent(this.databaseId.projectId),o=encodeURIComponent(this.databaseId.database);this.wo=r+"://"+t.host,this.So=`projects/${i}/databases/${o}`,this.bo=this.databaseId.database==="(default)"?`project_id=${i}`:`project_id=${i}&database_id=${o}`}get Do(){return!1}Co(t,r,i,o,a){const u=bs(),l=this.vo(t,r.toUriEncodedString());O("RestConnection",`Sending RPC '${t}' ${u}:`,l,i);const d={"google-cloud-resource-prefix":this.So,"x-goog-request-params":this.bo};return this.Fo(d,o,a),this.Mo(t,l,d,i).then((p=>(O("RestConnection",`Received RPC '${t}' ${u}: `,p),p)),(p=>{throw xt("RestConnection",`RPC '${t}' ${u} failed with error: `,p,"url: ",l,"request:",i),p}))}xo(t,r,i,o,a,u){return this.Co(t,r,i,o,a)}Fo(t,r,i){t["X-Goog-Api-Client"]=(function(){return"gl-js/ fire/"+In})(),t["Content-Type"]="text/plain",this.databaseInfo.appId&&(t["X-Firebase-GMPID"]=this.databaseInfo.appId),r&&r.headers.forEach(((o,a)=>t[a]=o)),i&&i.headers.forEach(((o,a)=>t[a]=o))}vo(t,r){const i=ry[t];return`${this.wo}/v1/${r}:${i}`}terminate(){}}{constructor(e){super(e),this.forceLongPolling=e.forceLongPolling,this.autoDetectLongPolling=e.autoDetectLongPolling,this.useFetchStreams=e.useFetchStreams,this.longPollingOptions=e.longPollingOptions}Mo(e,t,r,i){const o=bs();return new Promise(((a,u)=>{const l=new hl;l.setWithCredentials(!0),l.listenOnce(fl.COMPLETE,(()=>{try{switch(l.getLastErrorCode()){case ti.NO_ERROR:const p=l.getResponseJson();O(Te,`XHR for RPC '${e}' ${o} received:`,JSON.stringify(p)),a(p);break;case ti.TIMEOUT:O(Te,`RPC '${e}' ${o} timed out`),u(new b(P.DEADLINE_EXCEEDED,"Request time out"));break;case ti.HTTP_ERROR:const y=l.getStatus();if(O(Te,`RPC '${e}' ${o} failed with status:`,y,"response text:",l.getResponseText()),y>0){let T=l.getResponseJson();Array.isArray(T)&&(T=T[0]);const S=T?.error;if(S&&S.status&&S.message){const V=(function(k){const B=k.toLowerCase().replace(/_/g,"-");return Object.values(P).indexOf(B)>=0?B:P.UNKNOWN})(S.status);u(new b(V,S.message))}else u(new b(P.UNKNOWN,"Server responded with status "+l.getStatus()))}else u(new b(P.UNAVAILABLE,"Connection failed."));break;default:x()}}finally{O(Te,`RPC '${e}' ${o} completed.`)}}));const d=JSON.stringify(i);O(Te,`RPC '${e}' ${o} sending request:`,i),l.send(t,"POST",d,r,15)}))}Oo(e,t,r){const i=bs(),o=[this.wo,"/","google.firestore.v1.Firestore","/",e,"/channel"],a=gl(),u=ml(),l={httpSessionIdParam:"gsessionid",initMessageHeaders:{},messageUrlParams:{database:`projects/${this.databaseId.projectId}/databases/${this.databaseId.database}`},sendRawJson:!0,supportsCrossDomainXhr:!0,internalChannelParams:{forwardChannelRequestTimeoutMs:6e5},forceLongPolling:this.forceLongPolling,detectBufferingProxy:this.autoDetectLongPolling},d=this.longPollingOptions.timeoutSeconds;d!==void 0&&(l.longPollingTimeout=Math.round(1e3*d)),this.useFetchStreams&&(l.xmlHttpFactory=new dl({})),this.Fo(l.initMessageHeaders,t,r),l.encodeInitMessageHeaders=!0;const p=o.join("");O(Te,`Creating RPC '${e}' stream ${i}: ${p}`,l);const y=a.createWebChannel(p,l);let T=!1,S=!1;const V=new iy({lo:k=>{S?O(Te,`Not sending because RPC '${e}' stream ${i} is closed:`,k):(T||(O(Te,`Opening RPC '${e}' stream ${i} transport.`),y.open(),T=!0),O(Te,`RPC '${e}' stream ${i} sending:`,k),y.send(k))},ho:()=>y.close()}),N=(k,B,W)=>{k.listen(B,(H=>{try{W(H)}catch(te){setTimeout((()=>{throw te}),0)}}))};return N(y,Hn.EventType.OPEN,(()=>{S||(O(Te,`RPC '${e}' stream ${i} transport opened.`),V.mo())})),N(y,Hn.EventType.CLOSE,(()=>{S||(S=!0,O(Te,`RPC '${e}' stream ${i} transport closed`),V.po())})),N(y,Hn.EventType.ERROR,(k=>{S||(S=!0,xt(Te,`RPC '${e}' stream ${i} transport errored:`,k),V.po(new b(P.UNAVAILABLE,"The operation could not be completed")))})),N(y,Hn.EventType.MESSAGE,(k=>{var B;if(!S){const W=k.data[0];K(!!W);const H=W,te=H.error||((B=H[0])===null||B===void 0?void 0:B.error);if(te){O(Te,`RPC '${e}' stream ${i} received error:`,te);const De=te.status;let ne=(function(_){const v=re[_];if(v!==void 0)return zl(v)})(De),E=te.message;ne===void 0&&(ne=P.INTERNAL,E="Unknown error status: "+De+" with message "+te.message),S=!0,V.po(new b(ne,E)),y.close()}else O(Te,`RPC '${e}' stream ${i} received:`,W),V.yo(W)}})),N(u,pl.STAT_EVENT,(k=>{k.stat===qs.PROXY?O(Te,`RPC '${e}' stream ${i} detected buffering proxy`):k.stat===qs.NOPROXY&&O(Te,`RPC '${e}' stream ${i} detected no buffering proxy`)})),setTimeout((()=>{V.fo()}),0),V}}function ks(){return typeof document<"u"?document:null}/**
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
 */function Li(n){return new g_(n,!0)}/**
 * @license
 * Copyright 2017 Google LLC
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
 */class Co{constructor(e,t,r=1e3,i=1.5,o=6e4){this.oi=e,this.timerId=t,this.No=r,this.Lo=i,this.Bo=o,this.ko=0,this.qo=null,this.Qo=Date.now(),this.reset()}reset(){this.ko=0}Ko(){this.ko=this.Bo}$o(e){this.cancel();const t=Math.floor(this.ko+this.Uo()),r=Math.max(0,Date.now()-this.Qo),i=Math.max(0,t-r);i>0&&O("ExponentialBackoff",`Backing off for ${i} ms (base delay: ${this.ko} ms, delay with jitter: ${t} ms, last attempt: ${r} ms ago)`),this.qo=this.oi.enqueueAfterDelay(this.timerId,i,(()=>(this.Qo=Date.now(),e()))),this.ko*=this.Lo,this.ko<this.No&&(this.ko=this.No),this.ko>this.Bo&&(this.ko=this.Bo)}Wo(){this.qo!==null&&(this.qo.skipDelay(),this.qo=null)}cancel(){this.qo!==null&&(this.qo.cancel(),this.qo=null)}Uo(){return(Math.random()-.5)*this.ko}}/**
 * @license
 * Copyright 2017 Google LLC
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
 */class rh{constructor(e,t,r,i,o,a,u,l){this.oi=e,this.Go=r,this.zo=i,this.connection=o,this.authCredentialsProvider=a,this.appCheckCredentialsProvider=u,this.listener=l,this.state=0,this.jo=0,this.Ho=null,this.Jo=null,this.stream=null,this.Yo=new Co(e,t)}Zo(){return this.state===1||this.state===5||this.Xo()}Xo(){return this.state===2||this.state===3}start(){this.state!==4?this.auth():this.e_()}async stop(){this.Zo()&&await this.close(0)}t_(){this.state=0,this.Yo.reset()}n_(){this.Xo()&&this.Ho===null&&(this.Ho=this.oi.enqueueAfterDelay(this.Go,6e4,(()=>this.r_())))}i_(e){this.s_(),this.stream.send(e)}async r_(){if(this.Xo())return this.close(0)}s_(){this.Ho&&(this.Ho.cancel(),this.Ho=null)}o_(){this.Jo&&(this.Jo.cancel(),this.Jo=null)}async close(e,t){this.s_(),this.o_(),this.Yo.cancel(),this.jo++,e!==4?this.Yo.reset():t&&t.code===P.RESOURCE_EXHAUSTED?(st(t.toString()),st("Using maximum backoff delay to prevent overloading the backend."),this.Yo.Ko()):t&&t.code===P.UNAUTHENTICATED&&this.state!==3&&(this.authCredentialsProvider.invalidateToken(),this.appCheckCredentialsProvider.invalidateToken()),this.stream!==null&&(this.__(),this.stream.close(),this.stream=null),this.state=e,await this.listener.Ao(t)}__(){}auth(){this.state=1;const e=this.a_(this.jo),t=this.jo;Promise.all([this.authCredentialsProvider.getToken(),this.appCheckCredentialsProvider.getToken()]).then((([r,i])=>{this.jo===t&&this.u_(r,i)}),(r=>{e((()=>{const i=new b(P.UNKNOWN,"Fetching auth token failed: "+r.message);return this.c_(i)}))}))}u_(e,t){const r=this.a_(this.jo);this.stream=this.l_(e,t),this.stream.Po((()=>{r((()=>this.listener.Po()))})),this.stream.To((()=>{r((()=>(this.state=2,this.Jo=this.oi.enqueueAfterDelay(this.zo,1e4,(()=>(this.Xo()&&(this.state=3),Promise.resolve()))),this.listener.To())))})),this.stream.Ao((i=>{r((()=>this.c_(i)))})),this.stream.onMessage((i=>{r((()=>this.onMessage(i)))}))}e_(){this.state=5,this.Yo.$o((async()=>{this.state=0,this.start()}))}c_(e){return O("PersistentStream",`close with error: ${e}`),this.stream=null,this.close(4,e)}a_(e){return t=>{this.oi.enqueueAndForget((()=>this.jo===e?t():(O("PersistentStream","stream callback skipped by getCloseGuardedDispatcher."),Promise.resolve())))}}}class oy extends rh{constructor(e,t,r,i,o,a){super(e,"listen_stream_connection_backoff","listen_stream_idle","health_check_timeout",t,r,i,a),this.serializer=o}l_(e,t){return this.connection.Oo("Listen",e,t)}onMessage(e){this.Yo.reset();const t=E_(this.serializer,e),r=(function(o){if(!("targetChange"in o))return F.min();const a=o.targetChange;return a.targetIds&&a.targetIds.length?F.min():a.readTime?ke(a.readTime):F.min()})(e);return this.listener.h_(t,r)}P_(e){const t={};t.database=Qs(this.serializer),t.addTarget=(function(o,a){let u;const l=a.target;if(u=Ws(l)?{documents:T_(o,l)}:{query:w_(o,l)._t},u.targetId=a.targetId,a.resumeToken.approximateByteSize()>0){u.resumeToken=Hl(o,a.resumeToken);const d=Hs(o,a.expectedCount);d!==null&&(u.expectedCount=d)}else if(a.snapshotVersion.compareTo(F.min())>0){u.readTime=mi(o,a.snapshotVersion.toTimestamp());const d=Hs(o,a.expectedCount);d!==null&&(u.expectedCount=d)}return u})(this.serializer,e);const r=R_(this.serializer,e);r&&(t.labels=r),this.i_(t)}I_(e){const t={};t.database=Qs(this.serializer),t.removeTarget=e,this.i_(t)}}class ay extends rh{constructor(e,t,r,i,o,a){super(e,"write_stream_connection_backoff","write_stream_idle","health_check_timeout",t,r,i,a),this.serializer=o,this.T_=!1}get E_(){return this.T_}start(){this.T_=!1,this.lastStreamToken=void 0,super.start()}__(){this.T_&&this.d_([])}l_(e,t){return this.connection.Oo("Write",e,t)}onMessage(e){if(K(!!e.streamToken),this.lastStreamToken=e.streamToken,this.T_){this.Yo.reset();const t=I_(e.writeResults,e.commitTime),r=ke(e.commitTime);return this.listener.A_(r,t)}return K(!e.writeResults||e.writeResults.length===0),this.T_=!0,this.listener.R_()}V_(){const e={};e.database=Qs(this.serializer),this.i_(e)}d_(e){const t={streamToken:this.lastStreamToken,writes:e.map((r=>Xl(this.serializer,r)))};this.i_(t)}}/**
 * @license
 * Copyright 2017 Google LLC
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
 */class cy extends class{}{constructor(e,t,r,i){super(),this.authCredentials=e,this.appCheckCredentials=t,this.connection=r,this.serializer=i,this.m_=!1}f_(){if(this.m_)throw new b(P.FAILED_PRECONDITION,"The client has already been terminated.")}Co(e,t,r,i){return this.f_(),Promise.all([this.authCredentials.getToken(),this.appCheckCredentials.getToken()]).then((([o,a])=>this.connection.Co(e,Ks(t,r),i,o,a))).catch((o=>{throw o.name==="FirebaseError"?(o.code===P.UNAUTHENTICATED&&(this.authCredentials.invalidateToken(),this.appCheckCredentials.invalidateToken()),o):new b(P.UNKNOWN,o.toString())}))}xo(e,t,r,i,o){return this.f_(),Promise.all([this.authCredentials.getToken(),this.appCheckCredentials.getToken()]).then((([a,u])=>this.connection.xo(e,Ks(t,r),i,a,u,o))).catch((a=>{throw a.name==="FirebaseError"?(a.code===P.UNAUTHENTICATED&&(this.authCredentials.invalidateToken(),this.appCheckCredentials.invalidateToken()),a):new b(P.UNKNOWN,a.toString())}))}terminate(){this.m_=!0,this.connection.terminate()}}class uy{constructor(e,t){this.asyncQueue=e,this.onlineStateHandler=t,this.state="Unknown",this.g_=0,this.p_=null,this.y_=!0}w_(){this.g_===0&&(this.S_("Unknown"),this.p_=this.asyncQueue.enqueueAfterDelay("online_state_timeout",1e4,(()=>(this.p_=null,this.b_("Backend didn't respond within 10 seconds."),this.S_("Offline"),Promise.resolve()))))}D_(e){this.state==="Online"?this.S_("Unknown"):(this.g_++,this.g_>=1&&(this.C_(),this.b_(`Connection failed 1 times. Most recent error: ${e.toString()}`),this.S_("Offline")))}set(e){this.C_(),this.g_=0,e==="Online"&&(this.y_=!1),this.S_(e)}S_(e){e!==this.state&&(this.state=e,this.onlineStateHandler(e))}b_(e){const t=`Could not reach Cloud Firestore backend. ${e}
This typically indicates that your device does not have a healthy Internet connection at the moment. The client will operate in offline mode until it is able to successfully connect to the backend.`;this.y_?(st(t),this.y_=!1):O("OnlineStateTracker",t)}C_(){this.p_!==null&&(this.p_.cancel(),this.p_=null)}}/**
 * @license
 * Copyright 2017 Google LLC
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
 */class ly{constructor(e,t,r,i,o){this.localStore=e,this.datastore=t,this.asyncQueue=r,this.remoteSyncer={},this.v_=[],this.F_=new Map,this.M_=new Set,this.x_=[],this.O_=o,this.O_.io((a=>{r.enqueueAndForget((async()=>{$t(this)&&(O("RemoteStore","Restarting streams for network reachability change."),await(async function(l){const d=U(l);d.M_.add(4),await wr(d),d.N_.set("Unknown"),d.M_.delete(4),await xi(d)})(this))}))})),this.N_=new uy(r,i)}}async function xi(n){if($t(n))for(const e of n.x_)await e(!0)}async function wr(n){for(const e of n.x_)await e(!1)}function ih(n,e){const t=U(n);t.F_.has(e.targetId)||(t.F_.set(e.targetId,e),Vo(t)?Do(t):wn(t).Xo()&&ko(t,e))}function bo(n,e){const t=U(n),r=wn(t);t.F_.delete(e),r.Xo()&&sh(t,e),t.F_.size===0&&(r.Xo()?r.n_():$t(t)&&t.N_.set("Unknown"))}function ko(n,e){if(n.L_.xe(e.targetId),e.resumeToken.approximateByteSize()>0||e.snapshotVersion.compareTo(F.min())>0){const t=n.remoteSyncer.getRemoteKeysForTarget(e.targetId).size;e=e.withExpectedCount(t)}wn(n).P_(e)}function sh(n,e){n.L_.xe(e),wn(n).I_(e)}function Do(n){n.L_=new d_({getRemoteKeysForTarget:e=>n.remoteSyncer.getRemoteKeysForTarget(e),ot:e=>n.F_.get(e)||null,tt:()=>n.datastore.serializer.databaseId}),wn(n).start(),n.N_.w_()}function Vo(n){return $t(n)&&!wn(n).Zo()&&n.F_.size>0}function $t(n){return U(n).M_.size===0}function oh(n){n.L_=void 0}async function hy(n){n.N_.set("Online")}async function dy(n){n.F_.forEach(((e,t)=>{ko(n,e)}))}async function fy(n,e){oh(n),Vo(n)?(n.N_.D_(e),Do(n)):n.N_.set("Unknown")}async function py(n,e,t){if(n.N_.set("Online"),e instanceof Gl&&e.state===2&&e.cause)try{await(async function(i,o){const a=o.cause;for(const u of o.targetIds)i.F_.has(u)&&(await i.remoteSyncer.rejectListen(u,a),i.F_.delete(u),i.L_.removeTarget(u))})(n,e)}catch(r){O("RemoteStore","Failed to remove targets %s: %s ",e.targetIds.join(","),r),await _i(n,r)}else if(e instanceof ii?n.L_.Ke(e):e instanceof Wl?n.L_.He(e):n.L_.We(e),!t.isEqual(F.min()))try{const r=await nh(n.localStore);t.compareTo(r)>=0&&await(function(o,a){const u=o.L_.rt(a);return u.targetChanges.forEach(((l,d)=>{if(l.resumeToken.approximateByteSize()>0){const p=o.F_.get(d);p&&o.F_.set(d,p.withResumeToken(l.resumeToken,a))}})),u.targetMismatches.forEach(((l,d)=>{const p=o.F_.get(l);if(!p)return;o.F_.set(l,p.withResumeToken(_e.EMPTY_BYTE_STRING,p.snapshotVersion)),sh(o,l);const y=new mt(p.target,l,d,p.sequenceNumber);ko(o,y)})),o.remoteSyncer.applyRemoteEvent(u)})(n,t)}catch(r){O("RemoteStore","Failed to raise snapshot:",r),await _i(n,r)}}async function _i(n,e,t){if(!yr(e))throw e;n.M_.add(1),await wr(n),n.N_.set("Offline"),t||(t=()=>nh(n.localStore)),n.asyncQueue.enqueueRetryable((async()=>{O("RemoteStore","Retrying IndexedDB access"),await t(),n.M_.delete(1),await xi(n)}))}function ah(n,e){return e().catch((t=>_i(n,t,e)))}async function Fi(n){const e=U(n),t=Tt(e);let r=e.v_.length>0?e.v_[e.v_.length-1].batchId:-1;for(;my(e);)try{const i=await J_(e.localStore,r);if(i===null){e.v_.length===0&&t.n_();break}r=i.batchId,gy(e,i)}catch(i){await _i(e,i)}ch(e)&&uh(e)}function my(n){return $t(n)&&n.v_.length<10}function gy(n,e){n.v_.push(e);const t=Tt(n);t.Xo()&&t.E_&&t.d_(e.mutations)}function ch(n){return $t(n)&&!Tt(n).Zo()&&n.v_.length>0}function uh(n){Tt(n).start()}async function _y(n){Tt(n).V_()}async function yy(n){const e=Tt(n);for(const t of n.v_)e.d_(t.mutations)}async function vy(n,e,t){const r=n.v_.shift(),i=To.from(r,e,t);await ah(n,(()=>n.remoteSyncer.applySuccessfulWrite(i))),await Fi(n)}async function Ey(n,e){e&&Tt(n).E_&&await(async function(r,i){if((function(a){return $l(a)&&a!==P.ABORTED})(i.code)){const o=r.v_.shift();Tt(r).t_(),await ah(r,(()=>r.remoteSyncer.rejectFailedWrite(o.batchId,i))),await Fi(r)}})(n,e),ch(n)&&uh(n)}async function Yc(n,e){const t=U(n);t.asyncQueue.verifyOperationInProgress(),O("RemoteStore","RemoteStore received new credentials");const r=$t(t);t.M_.add(3),await wr(t),r&&t.N_.set("Unknown"),await t.remoteSyncer.handleCredentialChange(e),t.M_.delete(3),await xi(t)}async function Iy(n,e){const t=U(n);e?(t.M_.delete(2),await xi(t)):e||(t.M_.add(2),await wr(t),t.N_.set("Unknown"))}function wn(n){return n.B_||(n.B_=(function(t,r,i){const o=U(t);return o.f_(),new oy(r,o.connection,o.authCredentials,o.appCheckCredentials,o.serializer,i)})(n.datastore,n.asyncQueue,{Po:hy.bind(null,n),To:dy.bind(null,n),Ao:fy.bind(null,n),h_:py.bind(null,n)}),n.x_.push((async e=>{e?(n.B_.t_(),Vo(n)?Do(n):n.N_.set("Unknown")):(await n.B_.stop(),oh(n))}))),n.B_}function Tt(n){return n.k_||(n.k_=(function(t,r,i){const o=U(t);return o.f_(),new ay(r,o.connection,o.authCredentials,o.appCheckCredentials,o.serializer,i)})(n.datastore,n.asyncQueue,{Po:()=>Promise.resolve(),To:_y.bind(null,n),Ao:Ey.bind(null,n),R_:yy.bind(null,n),A_:vy.bind(null,n)}),n.x_.push((async e=>{e?(n.k_.t_(),await Fi(n)):(await n.k_.stop(),n.v_.length>0&&(O("RemoteStore",`Stopping write stream with ${n.v_.length} pending writes`),n.v_=[]))}))),n.k_}/**
 * @license
 * Copyright 2017 Google LLC
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
 */class No{constructor(e,t,r,i,o){this.asyncQueue=e,this.timerId=t,this.targetTimeMs=r,this.op=i,this.removalCallback=o,this.deferred=new qe,this.then=this.deferred.promise.then.bind(this.deferred.promise),this.deferred.promise.catch((a=>{}))}get promise(){return this.deferred.promise}static createAndSchedule(e,t,r,i,o){const a=Date.now()+r,u=new No(e,t,a,i,o);return u.start(r),u}start(e){this.timerHandle=setTimeout((()=>this.handleDelayElapsed()),e)}skipDelay(){return this.handleDelayElapsed()}cancel(e){this.timerHandle!==null&&(this.clearTimeout(),this.deferred.reject(new b(P.CANCELLED,"Operation cancelled"+(e?": "+e:""))))}handleDelayElapsed(){this.asyncQueue.enqueueAndForget((()=>this.timerHandle!==null?(this.clearTimeout(),this.op().then((e=>this.deferred.resolve(e)))):Promise.resolve()))}clearTimeout(){this.timerHandle!==null&&(this.removalCallback(this),clearTimeout(this.timerHandle),this.timerHandle=null)}}function Oo(n,e){if(st("AsyncQueue",`${e}: ${n}`),yr(n))return new b(P.UNAVAILABLE,`${e}: ${n}`);throw n}/**
 * @license
 * Copyright 2017 Google LLC
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
 */class on{constructor(e){this.comparator=e?(t,r)=>e(t,r)||M.comparator(t.key,r.key):(t,r)=>M.comparator(t.key,r.key),this.keyedMap=Kn(),this.sortedSet=new Z(this.comparator)}static emptySet(e){return new on(e.comparator)}has(e){return this.keyedMap.get(e)!=null}get(e){return this.keyedMap.get(e)}first(){return this.sortedSet.minKey()}last(){return this.sortedSet.maxKey()}isEmpty(){return this.sortedSet.isEmpty()}indexOf(e){const t=this.keyedMap.get(e);return t?this.sortedSet.indexOf(t):-1}get size(){return this.sortedSet.size}forEach(e){this.sortedSet.inorderTraversal(((t,r)=>(e(t),!1)))}add(e){const t=this.delete(e.key);return t.copy(t.keyedMap.insert(e.key,e),t.sortedSet.insert(e,null))}delete(e){const t=this.get(e);return t?this.copy(this.keyedMap.remove(e),this.sortedSet.remove(t)):this}isEqual(e){if(!(e instanceof on)||this.size!==e.size)return!1;const t=this.sortedSet.getIterator(),r=e.sortedSet.getIterator();for(;t.hasNext();){const i=t.getNext().key,o=r.getNext().key;if(!i.isEqual(o))return!1}return!0}toString(){const e=[];return this.forEach((t=>{e.push(t.toString())})),e.length===0?"DocumentSet ()":`DocumentSet (
  `+e.join(`  
`)+`
)`}copy(e,t){const r=new on;return r.comparator=this.comparator,r.keyedMap=e,r.sortedSet=t,r}}/**
 * @license
 * Copyright 2017 Google LLC
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
 */class Xc{constructor(){this.q_=new Z(M.comparator)}track(e){const t=e.doc.key,r=this.q_.get(t);r?e.type!==0&&r.type===3?this.q_=this.q_.insert(t,e):e.type===3&&r.type!==1?this.q_=this.q_.insert(t,{type:r.type,doc:e.doc}):e.type===2&&r.type===2?this.q_=this.q_.insert(t,{type:2,doc:e.doc}):e.type===2&&r.type===0?this.q_=this.q_.insert(t,{type:0,doc:e.doc}):e.type===1&&r.type===0?this.q_=this.q_.remove(t):e.type===1&&r.type===2?this.q_=this.q_.insert(t,{type:1,doc:r.doc}):e.type===0&&r.type===1?this.q_=this.q_.insert(t,{type:2,doc:e.doc}):x():this.q_=this.q_.insert(t,e)}Q_(){const e=[];return this.q_.inorderTraversal(((t,r)=>{e.push(r)})),e}}class _n{constructor(e,t,r,i,o,a,u,l,d){this.query=e,this.docs=t,this.oldDocs=r,this.docChanges=i,this.mutatedKeys=o,this.fromCache=a,this.syncStateChanged=u,this.excludesMetadataChanges=l,this.hasCachedResults=d}static fromInitialDocuments(e,t,r,i,o){const a=[];return t.forEach((u=>{a.push({type:0,doc:u})})),new _n(e,t,on.emptySet(t),a,r,i,!0,!1,o)}get hasPendingWrites(){return!this.mutatedKeys.isEmpty()}isEqual(e){if(!(this.fromCache===e.fromCache&&this.hasCachedResults===e.hasCachedResults&&this.syncStateChanged===e.syncStateChanged&&this.mutatedKeys.isEqual(e.mutatedKeys)&&Di(this.query,e.query)&&this.docs.isEqual(e.docs)&&this.oldDocs.isEqual(e.oldDocs)))return!1;const t=this.docChanges,r=e.docChanges;if(t.length!==r.length)return!1;for(let i=0;i<t.length;i++)if(t[i].type!==r[i].type||!t[i].doc.isEqual(r[i].doc))return!1;return!0}}/**
 * @license
 * Copyright 2017 Google LLC
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
 */class Ty{constructor(){this.K_=void 0,this.U_=[]}W_(){return this.U_.some((e=>e.G_()))}}class wy{constructor(){this.queries=new Tn((e=>Cl(e)),Di),this.onlineState="Unknown",this.z_=new Set}}async function Mo(n,e){const t=U(n);let r=3;const i=e.query;let o=t.queries.get(i);o?!o.W_()&&e.G_()&&(r=2):(o=new Ty,r=e.G_()?0:1);try{switch(r){case 0:o.K_=await t.onListen(i,!0);break;case 1:o.K_=await t.onListen(i,!1);break;case 2:await t.onFirstRemoteStoreListen(i)}}catch(a){const u=Oo(a,`Initialization of query '${Jt(e.query)}' failed`);return void e.onError(u)}t.queries.set(i,o),o.U_.push(e),e.j_(t.onlineState),o.K_&&e.H_(o.K_)&&xo(t)}async function Lo(n,e){const t=U(n),r=e.query;let i=3;const o=t.queries.get(r);if(o){const a=o.U_.indexOf(e);a>=0&&(o.U_.splice(a,1),o.U_.length===0?i=e.G_()?0:1:!o.W_()&&e.G_()&&(i=2))}switch(i){case 0:return t.queries.delete(r),t.onUnlisten(r,!0);case 1:return t.queries.delete(r),t.onUnlisten(r,!1);case 2:return t.onLastRemoteStoreUnlisten(r);default:return}}function Ay(n,e){const t=U(n);let r=!1;for(const i of e){const o=i.query,a=t.queries.get(o);if(a){for(const u of a.U_)u.H_(i)&&(r=!0);a.K_=i}}r&&xo(t)}function Ry(n,e,t){const r=U(n),i=r.queries.get(e);if(i)for(const o of i.U_)o.onError(t);r.queries.delete(e)}function xo(n){n.z_.forEach((e=>{e.next()}))}var Xs,Jc;(Jc=Xs||(Xs={})).J_="default",Jc.Cache="cache";class Fo{constructor(e,t,r){this.query=e,this.Y_=t,this.Z_=!1,this.X_=null,this.onlineState="Unknown",this.options=r||{}}H_(e){if(!this.options.includeMetadataChanges){const r=[];for(const i of e.docChanges)i.type!==3&&r.push(i);e=new _n(e.query,e.docs,e.oldDocs,r,e.mutatedKeys,e.fromCache,e.syncStateChanged,!0,e.hasCachedResults)}let t=!1;return this.Z_?this.ea(e)&&(this.Y_.next(e),t=!0):this.ta(e,this.onlineState)&&(this.na(e),t=!0),this.X_=e,t}onError(e){this.Y_.error(e)}j_(e){this.onlineState=e;let t=!1;return this.X_&&!this.Z_&&this.ta(this.X_,e)&&(this.na(this.X_),t=!0),t}ta(e,t){if(!e.fromCache||!this.G_())return!0;const r=t!=="Offline";return(!this.options.ra||!r)&&(!e.docs.isEmpty()||e.hasCachedResults||t==="Offline")}ea(e){if(e.docChanges.length>0)return!0;const t=this.X_&&this.X_.hasPendingWrites!==e.hasPendingWrites;return!(!e.syncStateChanged&&!t)&&this.options.includeMetadataChanges===!0}na(e){e=_n.fromInitialDocuments(e.query,e.docs,e.mutatedKeys,e.fromCache,e.hasCachedResults),this.Z_=!0,this.Y_.next(e)}G_(){return this.options.source!==Xs.Cache}}/**
 * @license
 * Copyright 2017 Google LLC
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
 */class lh{constructor(e){this.key=e}}class hh{constructor(e){this.key=e}}class Py{constructor(e,t){this.query=e,this.la=t,this.ha=null,this.hasCachedResults=!1,this.current=!1,this.Pa=q(),this.mutatedKeys=q(),this.Ia=bl(e),this.Ta=new on(this.Ia)}get Ea(){return this.la}da(e,t){const r=t?t.Aa:new Xc,i=t?t.Ta:this.Ta;let o=t?t.mutatedKeys:this.mutatedKeys,a=i,u=!1;const l=this.query.limitType==="F"&&i.size===this.query.limit?i.last():null,d=this.query.limitType==="L"&&i.size===this.query.limit?i.first():null;if(e.inorderTraversal(((p,y)=>{const T=i.get(p),S=Vi(this.query,y)?y:null,V=!!T&&this.mutatedKeys.has(T.key),N=!!S&&(S.hasLocalMutations||this.mutatedKeys.has(S.key)&&S.hasCommittedMutations);let k=!1;T&&S?T.data.isEqual(S.data)?V!==N&&(r.track({type:3,doc:S}),k=!0):this.Ra(T,S)||(r.track({type:2,doc:S}),k=!0,(l&&this.Ia(S,l)>0||d&&this.Ia(S,d)<0)&&(u=!0)):!T&&S?(r.track({type:0,doc:S}),k=!0):T&&!S&&(r.track({type:1,doc:T}),k=!0,(l||d)&&(u=!0)),k&&(S?(a=a.add(S),o=N?o.add(p):o.delete(p)):(a=a.delete(p),o=o.delete(p)))})),this.query.limit!==null)for(;a.size>this.query.limit;){const p=this.query.limitType==="F"?a.last():a.first();a=a.delete(p.key),o=o.delete(p.key),r.track({type:1,doc:p})}return{Ta:a,Aa:r,Xi:u,mutatedKeys:o}}Ra(e,t){return e.hasLocalMutations&&t.hasCommittedMutations&&!t.hasLocalMutations}applyChanges(e,t,r,i){const o=this.Ta;this.Ta=e.Ta,this.mutatedKeys=e.mutatedKeys;const a=e.Aa.Q_();a.sort(((p,y)=>(function(S,V){const N=k=>{switch(k){case 0:return 1;case 2:case 3:return 2;case 1:return 0;default:return x()}};return N(S)-N(V)})(p.type,y.type)||this.Ia(p.doc,y.doc))),this.Va(r),i=i!=null&&i;const u=t&&!i?this.ma():[],l=this.Pa.size===0&&this.current&&!i?1:0,d=l!==this.ha;return this.ha=l,a.length!==0||d?{snapshot:new _n(this.query,e.Ta,o,a,e.mutatedKeys,l===0,d,!1,!!r&&r.resumeToken.approximateByteSize()>0),fa:u}:{fa:u}}j_(e){return this.current&&e==="Offline"?(this.current=!1,this.applyChanges({Ta:this.Ta,Aa:new Xc,mutatedKeys:this.mutatedKeys,Xi:!1},!1)):{fa:[]}}ga(e){return!this.la.has(e)&&!!this.Ta.has(e)&&!this.Ta.get(e).hasLocalMutations}Va(e){e&&(e.addedDocuments.forEach((t=>this.la=this.la.add(t))),e.modifiedDocuments.forEach((t=>{})),e.removedDocuments.forEach((t=>this.la=this.la.delete(t))),this.current=e.current)}ma(){if(!this.current)return[];const e=this.Pa;this.Pa=q(),this.Ta.forEach((r=>{this.ga(r.key)&&(this.Pa=this.Pa.add(r.key))}));const t=[];return e.forEach((r=>{this.Pa.has(r)||t.push(new hh(r))})),this.Pa.forEach((r=>{e.has(r)||t.push(new lh(r))})),t}pa(e){this.la=e.hs,this.Pa=q();const t=this.da(e.documents);return this.applyChanges(t,!0)}ya(){return _n.fromInitialDocuments(this.query,this.Ta,this.mutatedKeys,this.ha===0,this.hasCachedResults)}}class Sy{constructor(e,t,r){this.query=e,this.targetId=t,this.view=r}}class Cy{constructor(e){this.key=e,this.wa=!1}}class by{constructor(e,t,r,i,o,a){this.localStore=e,this.remoteStore=t,this.eventManager=r,this.sharedClientState=i,this.currentUser=o,this.maxConcurrentLimboResolutions=a,this.Sa={},this.ba=new Tn((u=>Cl(u)),Di),this.Da=new Map,this.Ca=new Set,this.va=new Z(M.comparator),this.Fa=new Map,this.Ma=new Ro,this.xa={},this.Oa=new Map,this.Na=gn.Ln(),this.onlineState="Unknown",this.La=void 0}get isPrimaryClient(){return this.La===!0}}async function ky(n,e,t=!0){const r=_h(n);let i;const o=r.ba.get(e);return o?(r.sharedClientState.addLocalQueryTarget(o.targetId),i=o.view.ya()):i=await dh(r,e,t,!0),i}async function Dy(n,e){const t=_h(n);await dh(t,e,!0,!1)}async function dh(n,e,t,r){const i=await Z_(n.localStore,je(e)),o=i.targetId,a=t?n.sharedClientState.addLocalQueryTarget(o):"not-current";let u;return r&&(u=await Vy(n,e,o,a==="current",i.resumeToken)),n.isPrimaryClient&&t&&ih(n.remoteStore,i),u}async function Vy(n,e,t,r,i){n.Ba=(y,T,S)=>(async function(N,k,B,W){let H=k.view.da(B);H.Xi&&(H=await Hc(N.localStore,k.query,!1).then((({documents:E})=>k.view.da(E,H))));const te=W&&W.targetChanges.get(k.targetId),De=W&&W.targetMismatches.get(k.targetId)!=null,ne=k.view.applyChanges(H,N.isPrimaryClient,te,De);return eu(N,k.targetId,ne.fa),ne.snapshot})(n,y,T,S);const o=await Hc(n.localStore,e,!0),a=new Py(e,o.hs),u=a.da(o.documents),l=Tr.createSynthesizedTargetChangeForCurrentChange(t,r&&n.onlineState!=="Offline",i),d=a.applyChanges(u,n.isPrimaryClient,l);eu(n,t,d.fa);const p=new Sy(e,t,a);return n.ba.set(e,p),n.Da.has(t)?n.Da.get(t).push(e):n.Da.set(t,[e]),d.snapshot}async function Ny(n,e,t){const r=U(n),i=r.ba.get(e),o=r.Da.get(i.targetId);if(o.length>1)return r.Da.set(i.targetId,o.filter((a=>!Di(a,e)))),void r.ba.delete(e);r.isPrimaryClient?(r.sharedClientState.removeLocalQueryTarget(i.targetId),r.sharedClientState.isActiveQueryTarget(i.targetId)||await Ys(r.localStore,i.targetId,!1).then((()=>{r.sharedClientState.clearQueryState(i.targetId),t&&bo(r.remoteStore,i.targetId),Js(r,i.targetId)})).catch(_r)):(Js(r,i.targetId),await Ys(r.localStore,i.targetId,!0))}async function Oy(n,e){const t=U(n),r=t.ba.get(e),i=t.Da.get(r.targetId);t.isPrimaryClient&&i.length===1&&(t.sharedClientState.removeLocalQueryTarget(r.targetId),bo(t.remoteStore,r.targetId))}async function My(n,e,t){const r=jy(n);try{const i=await(function(a,u){const l=U(a),d=ae.now(),p=u.reduce(((S,V)=>S.add(V.key)),q());let y,T;return l.persistence.runTransaction("Locally write mutations","readwrite",(S=>{let V=ot(),N=q();return l.os.getEntries(S,p).next((k=>{V=k,V.forEach(((B,W)=>{W.isValidDocument()||(N=N.add(B))}))})).next((()=>l.localDocuments.getOverlayedDocuments(S,V))).next((k=>{y=k;const B=[];for(const W of u){const H=o_(W,y.get(W.key).overlayedDocument);H!=null&&B.push(new At(W.key,H,Il(H.value.mapValue),oe.exists(!0)))}return l.mutationQueue.addMutationBatch(S,d,B,u)})).next((k=>{T=k;const B=k.applyToLocalDocumentSet(y,N);return l.documentOverlayCache.saveOverlays(S,k.batchId,B)}))})).then((()=>({batchId:T.batchId,changes:Dl(y)})))})(r.localStore,e);r.sharedClientState.addPendingMutation(i.batchId),(function(a,u,l){let d=a.xa[a.currentUser.toKey()];d||(d=new Z(G)),d=d.insert(u,l),a.xa[a.currentUser.toKey()]=d})(r,i.batchId,t),await Ar(r,i.changes),await Fi(r.remoteStore)}catch(i){const o=Oo(i,"Failed to persist write");t.reject(o)}}async function fh(n,e){const t=U(n);try{const r=await Y_(t.localStore,e);e.targetChanges.forEach(((i,o)=>{const a=t.Fa.get(o);a&&(K(i.addedDocuments.size+i.modifiedDocuments.size+i.removedDocuments.size<=1),i.addedDocuments.size>0?a.wa=!0:i.modifiedDocuments.size>0?K(a.wa):i.removedDocuments.size>0&&(K(a.wa),a.wa=!1))})),await Ar(t,r,e)}catch(r){await _r(r)}}function Zc(n,e,t){const r=U(n);if(r.isPrimaryClient&&t===0||!r.isPrimaryClient&&t===1){const i=[];r.ba.forEach(((o,a)=>{const u=a.view.j_(e);u.snapshot&&i.push(u.snapshot)})),(function(a,u){const l=U(a);l.onlineState=u;let d=!1;l.queries.forEach(((p,y)=>{for(const T of y.U_)T.j_(u)&&(d=!0)})),d&&xo(l)})(r.eventManager,e),i.length&&r.Sa.h_(i),r.onlineState=e,r.isPrimaryClient&&r.sharedClientState.setOnlineState(e)}}async function Ly(n,e,t){const r=U(n);r.sharedClientState.updateQueryState(e,"rejected",t);const i=r.Fa.get(e),o=i&&i.key;if(o){let a=new Z(M.comparator);a=a.insert(o,ue.newNoDocument(o,F.min()));const u=q().add(o),l=new Mi(F.min(),new Map,new Z(G),a,u);await fh(r,l),r.va=r.va.remove(o),r.Fa.delete(e),Uo(r)}else await Ys(r.localStore,e,!1).then((()=>Js(r,e,t))).catch(_r)}async function xy(n,e){const t=U(n),r=e.batch.batchId;try{const i=await Q_(t.localStore,e);mh(t,r,null),ph(t,r),t.sharedClientState.updateMutationState(r,"acknowledged"),await Ar(t,i)}catch(i){await _r(i)}}async function Fy(n,e,t){const r=U(n);try{const i=await(function(a,u){const l=U(a);return l.persistence.runTransaction("Reject batch","readwrite-primary",(d=>{let p;return l.mutationQueue.lookupMutationBatch(d,u).next((y=>(K(y!==null),p=y.keys(),l.mutationQueue.removeMutationBatch(d,y)))).next((()=>l.mutationQueue.performConsistencyCheck(d))).next((()=>l.documentOverlayCache.removeOverlaysForBatchId(d,p,u))).next((()=>l.localDocuments.recalculateAndSaveOverlaysForDocumentKeys(d,p))).next((()=>l.localDocuments.getDocuments(d,p)))}))})(r.localStore,e);mh(r,e,t),ph(r,e),r.sharedClientState.updateMutationState(e,"rejected",t),await Ar(r,i)}catch(i){await _r(i)}}function ph(n,e){(n.Oa.get(e)||[]).forEach((t=>{t.resolve()})),n.Oa.delete(e)}function mh(n,e,t){const r=U(n);let i=r.xa[r.currentUser.toKey()];if(i){const o=i.get(e);o&&(t?o.reject(t):o.resolve(),i=i.remove(e)),r.xa[r.currentUser.toKey()]=i}}function Js(n,e,t=null){n.sharedClientState.removeLocalQueryTarget(e);for(const r of n.Da.get(e))n.ba.delete(r),t&&n.Sa.ka(r,t);n.Da.delete(e),n.isPrimaryClient&&n.Ma.Vr(e).forEach((r=>{n.Ma.containsKey(r)||gh(n,r)}))}function gh(n,e){n.Ca.delete(e.path.canonicalString());const t=n.va.get(e);t!==null&&(bo(n.remoteStore,t),n.va=n.va.remove(e),n.Fa.delete(t),Uo(n))}function eu(n,e,t){for(const r of t)r instanceof lh?(n.Ma.addReference(r.key,e),Uy(n,r)):r instanceof hh?(O("SyncEngine","Document no longer in limbo: "+r.key),n.Ma.removeReference(r.key,e),n.Ma.containsKey(r.key)||gh(n,r.key)):x()}function Uy(n,e){const t=e.key,r=t.path.canonicalString();n.va.get(t)||n.Ca.has(r)||(O("SyncEngine","New document in limbo: "+t),n.Ca.add(r),Uo(n))}function Uo(n){for(;n.Ca.size>0&&n.va.size<n.maxConcurrentLimboResolutions;){const e=n.Ca.values().next().value;n.Ca.delete(e);const t=new M(Y.fromString(e)),r=n.Na.next();n.Fa.set(r,new Cy(t)),n.va=n.va.insert(t,r),ih(n.remoteStore,new mt(je(ki(t.path)),r,"TargetPurposeLimboResolution",mo.oe))}}async function Ar(n,e,t){const r=U(n),i=[],o=[],a=[];r.ba.isEmpty()||(r.ba.forEach(((u,l)=>{a.push(r.Ba(l,e,t).then((d=>{var p;if((d||t)&&r.isPrimaryClient){const y=d?!d.fromCache:(p=t?.targetChanges.get(l.targetId))===null||p===void 0?void 0:p.current;r.sharedClientState.updateQueryState(l.targetId,y?"current":"not-current")}if(d){i.push(d);const y=So.Ki(l.targetId,d);o.push(y)}})))})),await Promise.all(a),r.Sa.h_(i),await(async function(l,d){const p=U(l);try{await p.persistence.runTransaction("notifyLocalViewChanges","readwrite",(y=>C.forEach(d,(T=>C.forEach(T.qi,(S=>p.persistence.referenceDelegate.addReference(y,T.targetId,S))).next((()=>C.forEach(T.Qi,(S=>p.persistence.referenceDelegate.removeReference(y,T.targetId,S)))))))))}catch(y){if(!yr(y))throw y;O("LocalStore","Failed to update sequence numbers: "+y)}for(const y of d){const T=y.targetId;if(!y.fromCache){const S=p.ns.get(T),V=S.snapshotVersion,N=S.withLastLimboFreeSnapshotVersion(V);p.ns=p.ns.insert(T,N)}}})(r.localStore,o))}async function By(n,e){const t=U(n);if(!t.currentUser.isEqual(e)){O("SyncEngine","User change. New user:",e.toKey());const r=await th(t.localStore,e);t.currentUser=e,(function(o,a){o.Oa.forEach((u=>{u.forEach((l=>{l.reject(new b(P.CANCELLED,a))}))})),o.Oa.clear()})(t,"'waitForPendingWrites' promise is rejected due to a user change."),t.sharedClientState.handleUserChange(e,r.removedBatchIds,r.addedBatchIds),await Ar(t,r.us)}}function qy(n,e){const t=U(n),r=t.Fa.get(e);if(r&&r.wa)return q().add(r.key);{let i=q();const o=t.Da.get(e);if(!o)return i;for(const a of o){const u=t.ba.get(a);i=i.unionWith(u.view.Ea)}return i}}function _h(n){const e=U(n);return e.remoteStore.remoteSyncer.applyRemoteEvent=fh.bind(null,e),e.remoteStore.remoteSyncer.getRemoteKeysForTarget=qy.bind(null,e),e.remoteStore.remoteSyncer.rejectListen=Ly.bind(null,e),e.Sa.h_=Ay.bind(null,e.eventManager),e.Sa.ka=Ry.bind(null,e.eventManager),e}function jy(n){const e=U(n);return e.remoteStore.remoteSyncer.applySuccessfulWrite=xy.bind(null,e),e.remoteStore.remoteSyncer.rejectFailedWrite=Fy.bind(null,e),e}class tu{constructor(){this.synchronizeTabs=!1}async initialize(e){this.serializer=Li(e.databaseInfo.databaseId),this.sharedClientState=this.createSharedClientState(e),this.persistence=this.createPersistence(e),await this.persistence.start(),this.localStore=this.createLocalStore(e),this.gcScheduler=this.createGarbageCollectionScheduler(e,this.localStore),this.indexBackfillerScheduler=this.createIndexBackfillerScheduler(e,this.localStore)}createGarbageCollectionScheduler(e,t){return null}createIndexBackfillerScheduler(e,t){return null}createLocalStore(e){return K_(this.persistence,new G_,e.initialUser,this.serializer)}createPersistence(e){return new $_(Po.Hr,this.serializer)}createSharedClientState(e){return new ty}async terminate(){var e,t;(e=this.gcScheduler)===null||e===void 0||e.stop(),(t=this.indexBackfillerScheduler)===null||t===void 0||t.stop(),this.sharedClientState.shutdown(),await this.persistence.shutdown()}}class $y{async initialize(e,t){this.localStore||(this.localStore=e.localStore,this.sharedClientState=e.sharedClientState,this.datastore=this.createDatastore(t),this.remoteStore=this.createRemoteStore(t),this.eventManager=this.createEventManager(t),this.syncEngine=this.createSyncEngine(t,!e.synchronizeTabs),this.sharedClientState.onlineStateHandler=r=>Zc(this.syncEngine,r,1),this.remoteStore.remoteSyncer.handleCredentialChange=By.bind(null,this.syncEngine),await Iy(this.remoteStore,this.syncEngine.isPrimaryClient))}createEventManager(e){return(function(){return new wy})()}createDatastore(e){const t=Li(e.databaseInfo.databaseId),r=(function(o){return new sy(o)})(e.databaseInfo);return(function(o,a,u,l){return new cy(o,a,u,l)})(e.authCredentials,e.appCheckCredentials,r,t)}createRemoteStore(e){return(function(r,i,o,a,u){return new ly(r,i,o,a,u)})(this.localStore,this.datastore,e.asyncQueue,(t=>Zc(this.syncEngine,t,0)),(function(){return Qc.D()?new Qc:new ny})())}createSyncEngine(e,t){return(function(i,o,a,u,l,d,p){const y=new by(i,o,a,u,l,d);return p&&(y.La=!0),y})(this.localStore,this.remoteStore,this.eventManager,this.sharedClientState,e.initialUser,e.maxConcurrentLimboResolutions,t)}async terminate(){var e;await(async function(r){const i=U(r);O("RemoteStore","RemoteStore shutting down."),i.M_.add(5),await wr(i),i.O_.shutdown(),i.N_.set("Unknown")})(this.remoteStore),(e=this.datastore)===null||e===void 0||e.terminate()}}/**
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
 *//**
 * @license
 * Copyright 2017 Google LLC
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
 */class Bo{constructor(e){this.observer=e,this.muted=!1}next(e){this.observer.next&&this.Ka(this.observer.next,e)}error(e){this.observer.error?this.Ka(this.observer.error,e):st("Uncaught Error in snapshot listener:",e.toString())}$a(){this.muted=!0}Ka(e,t){this.muted||setTimeout((()=>{this.muted||e(t)}),0)}}/**
 * @license
 * Copyright 2017 Google LLC
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
 */class zy{constructor(e){this.datastore=e,this.readVersions=new Map,this.mutations=[],this.committed=!1,this.lastTransactionError=null,this.writtenDocs=new Set}async lookup(e){if(this.ensureCommitNotCalled(),this.mutations.length>0)throw this.lastTransactionError=new b(P.INVALID_ARGUMENT,"Firestore transactions require all reads to be executed before all writes."),this.lastTransactionError;const t=await(async function(i,o){const a=U(i),u={documents:o.map((y=>gi(a.serializer,y)))},l=await a.xo("BatchGetDocuments",a.serializer.databaseId,Y.emptyPath(),u,o.length),d=new Map;l.forEach((y=>{const T=v_(a.serializer,y);d.set(T.key.toString(),T)}));const p=[];return o.forEach((y=>{const T=d.get(y.toString());K(!!T),p.push(T)})),p})(this.datastore,e);return t.forEach((r=>this.recordVersion(r))),t}set(e,t){this.write(t.toMutation(e,this.precondition(e))),this.writtenDocs.add(e.toString())}update(e,t){try{this.write(t.toMutation(e,this.preconditionForUpdate(e)))}catch(r){this.lastTransactionError=r}this.writtenDocs.add(e.toString())}delete(e){this.write(new Ir(e,this.precondition(e))),this.writtenDocs.add(e.toString())}async commit(){if(this.ensureCommitNotCalled(),this.lastTransactionError)throw this.lastTransactionError;const e=this.readVersions;this.mutations.forEach((t=>{e.delete(t.key.toString())})),e.forEach(((t,r)=>{const i=M.fromPath(r);this.mutations.push(new jl(i,this.precondition(i)))})),await(async function(r,i){const o=U(r),a={writes:i.map((u=>Xl(o.serializer,u)))};await o.Co("Commit",o.serializer.databaseId,Y.emptyPath(),a)})(this.datastore,this.mutations),this.committed=!0}recordVersion(e){let t;if(e.isFoundDocument())t=e.version;else{if(!e.isNoDocument())throw x();t=F.min()}const r=this.readVersions.get(e.key.toString());if(r){if(!t.isEqual(r))throw new b(P.ABORTED,"Document version changed between two reads.")}else this.readVersions.set(e.key.toString(),t)}precondition(e){const t=this.readVersions.get(e.toString());return!this.writtenDocs.has(e.toString())&&t?t.isEqual(F.min())?oe.exists(!1):oe.updateTime(t):oe.none()}preconditionForUpdate(e){const t=this.readVersions.get(e.toString());if(!this.writtenDocs.has(e.toString())&&t){if(t.isEqual(F.min()))throw new b(P.INVALID_ARGUMENT,"Can't update a document that doesn't exist.");return oe.updateTime(t)}return oe.exists(!0)}write(e){this.ensureCommitNotCalled(),this.mutations.push(e)}ensureCommitNotCalled(){}}/**
 * @license
 * Copyright 2019 Google LLC
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
 */class Wy{constructor(e,t,r,i,o){this.asyncQueue=e,this.datastore=t,this.options=r,this.updateFunction=i,this.deferred=o,this.Za=r.maxAttempts,this.Yo=new Co(this.asyncQueue,"transaction_retry")}Xa(){this.Za-=1,this.eu()}eu(){this.Yo.$o((async()=>{const e=new zy(this.datastore),t=this.tu(e);t&&t.then((r=>{this.asyncQueue.enqueueAndForget((()=>e.commit().then((()=>{this.deferred.resolve(r)})).catch((i=>{this.nu(i)}))))})).catch((r=>{this.nu(r)}))}))}tu(e){try{const t=this.updateFunction(e);return!vr(t)&&t.catch&&t.then?t:(this.deferred.reject(Error("Transaction callback must return a Promise")),null)}catch(t){return this.deferred.reject(t),null}}nu(e){this.Za>0&&this.ru(e)?(this.Za-=1,this.asyncQueue.enqueueAndForget((()=>(this.eu(),Promise.resolve())))):this.deferred.reject(e)}ru(e){if(e.name==="FirebaseError"){const t=e.code;return t==="aborted"||t==="failed-precondition"||t==="already-exists"||!$l(t)}return!1}}/**
 * @license
 * Copyright 2017 Google LLC
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
 */class Gy{constructor(e,t,r,i){this.authCredentials=e,this.appCheckCredentials=t,this.asyncQueue=r,this.databaseInfo=i,this.user=we.UNAUTHENTICATED,this.clientId=po.newId(),this.authCredentialListener=()=>Promise.resolve(),this.appCheckCredentialListener=()=>Promise.resolve(),this.authCredentials.start(r,(async o=>{O("FirestoreClient","Received user=",o.uid),await this.authCredentialListener(o),this.user=o})),this.appCheckCredentials.start(r,(o=>(O("FirestoreClient","Received new app check token=",o),this.appCheckCredentialListener(o,this.user))))}get configuration(){return{asyncQueue:this.asyncQueue,databaseInfo:this.databaseInfo,clientId:this.clientId,authCredentials:this.authCredentials,appCheckCredentials:this.appCheckCredentials,initialUser:this.user,maxConcurrentLimboResolutions:100}}setCredentialChangeListener(e){this.authCredentialListener=e}setAppCheckTokenChangeListener(e){this.appCheckCredentialListener=e}verifyNotTerminated(){if(this.asyncQueue.isShuttingDown)throw new b(P.FAILED_PRECONDITION,"The client has already been terminated.")}terminate(){this.asyncQueue.enterRestrictedMode();const e=new qe;return this.asyncQueue.enqueueAndForgetEvenWhileRestricted((async()=>{try{this._onlineComponents&&await this._onlineComponents.terminate(),this._offlineComponents&&await this._offlineComponents.terminate(),this.authCredentials.shutdown(),this.appCheckCredentials.shutdown(),e.resolve()}catch(t){const r=Oo(t,"Failed to shutdown persistence");e.reject(r)}})),e.promise}}async function Ds(n,e){n.asyncQueue.verifyOperationInProgress(),O("FirestoreClient","Initializing OfflineComponentProvider");const t=n.configuration;await e.initialize(t);let r=t.initialUser;n.setCredentialChangeListener((async i=>{r.isEqual(i)||(await th(e.localStore,i),r=i)})),e.persistence.setDatabaseDeletedListener((()=>n.terminate())),n._offlineComponents=e}async function nu(n,e){n.asyncQueue.verifyOperationInProgress();const t=await Ky(n);O("FirestoreClient","Initializing OnlineComponentProvider"),await e.initialize(t,n.configuration),n.setCredentialChangeListener((r=>Yc(e.remoteStore,r))),n.setAppCheckTokenChangeListener(((r,i)=>Yc(e.remoteStore,i))),n._onlineComponents=e}function Hy(n){return n.name==="FirebaseError"?n.code===P.FAILED_PRECONDITION||n.code===P.UNIMPLEMENTED:!(typeof DOMException<"u"&&n instanceof DOMException)||n.code===22||n.code===20||n.code===11}async function Ky(n){if(!n._offlineComponents)if(n._uninitializedComponentsProvider){O("FirestoreClient","Using user provided OfflineComponentProvider");try{await Ds(n,n._uninitializedComponentsProvider._offline)}catch(e){const t=e;if(!Hy(t))throw t;xt("Error using user provided cache. Falling back to memory cache: "+t),await Ds(n,new tu)}}else O("FirestoreClient","Using default OfflineComponentProvider"),await Ds(n,new tu);return n._offlineComponents}async function qo(n){return n._onlineComponents||(n._uninitializedComponentsProvider?(O("FirestoreClient","Using user provided OnlineComponentProvider"),await nu(n,n._uninitializedComponentsProvider._online)):(O("FirestoreClient","Using default OnlineComponentProvider"),await nu(n,new $y))),n._onlineComponents}function Qy(n){return qo(n).then((e=>e.syncEngine))}function Yy(n){return qo(n).then((e=>e.datastore))}async function yi(n){const e=await qo(n),t=e.eventManager;return t.onListen=ky.bind(null,e.syncEngine),t.onUnlisten=Ny.bind(null,e.syncEngine),t.onFirstRemoteStoreListen=Dy.bind(null,e.syncEngine),t.onLastRemoteStoreUnlisten=Oy.bind(null,e.syncEngine),t}function Xy(n,e,t={}){const r=new qe;return n.asyncQueue.enqueueAndForget((async()=>(function(o,a,u,l,d){const p=new Bo({next:T=>{a.enqueueAndForget((()=>Lo(o,y)));const S=T.docs.has(u);!S&&T.fromCache?d.reject(new b(P.UNAVAILABLE,"Failed to get document because the client is offline.")):S&&T.fromCache&&l&&l.source==="server"?d.reject(new b(P.UNAVAILABLE,'Failed to get document from server. (However, this document does exist in the local cache. Run again without setting source to "server" to retrieve the cached document.)')):d.resolve(T)},error:T=>d.reject(T)}),y=new Fo(ki(u.path),p,{includeMetadataChanges:!0,ra:!0});return Mo(o,y)})(await yi(n),n.asyncQueue,e,t,r))),r.promise}function Jy(n,e,t={}){const r=new qe;return n.asyncQueue.enqueueAndForget((async()=>(function(o,a,u,l,d){const p=new Bo({next:T=>{a.enqueueAndForget((()=>Lo(o,y))),T.fromCache&&l.source==="server"?d.reject(new b(P.UNAVAILABLE,'Failed to get documents from server. (However, these documents may exist in the local cache. Run again without setting source to "server" to retrieve the cached documents.)')):d.resolve(T)},error:T=>d.reject(T)}),y=new Fo(u,p,{includeMetadataChanges:!0,ra:!0});return Mo(o,y)})(await yi(n),n.asyncQueue,e,t,r))),r.promise}/**
 * @license
 * Copyright 2023 Google LLC
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
 */function yh(n){const e={};return n.timeoutSeconds!==void 0&&(e.timeoutSeconds=n.timeoutSeconds),e}/**
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
 */const ru=new Map;/**
 * @license
 * Copyright 2017 Google LLC
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
 */function vh(n,e,t){if(!t)throw new b(P.INVALID_ARGUMENT,`Function ${n}() cannot be called with an empty ${e}.`)}function Eh(n,e,t,r){if(e===!0&&r===!0)throw new b(P.INVALID_ARGUMENT,`${n} and ${t} cannot be used together.`)}function iu(n){if(!M.isDocumentKey(n))throw new b(P.INVALID_ARGUMENT,`Invalid document reference. Document references must have an even number of segments, but ${n} has ${n.length}.`)}function su(n){if(M.isDocumentKey(n))throw new b(P.INVALID_ARGUMENT,`Invalid collection reference. Collection references must have an odd number of segments, but ${n} has ${n.length}.`)}function Ui(n){if(n===void 0)return"undefined";if(n===null)return"null";if(typeof n=="string")return n.length>20&&(n=`${n.substring(0,20)}...`),JSON.stringify(n);if(typeof n=="number"||typeof n=="boolean")return""+n;if(typeof n=="object"){if(n instanceof Array)return"an array";{const e=(function(r){return r.constructor?r.constructor.name:null})(n);return e?`a custom ${e} object`:"an object"}}return typeof n=="function"?"a function":x()}function me(n,e){if("_delegate"in n&&(n=n._delegate),!(n instanceof e)){if(e.name===n.constructor.name)throw new b(P.INVALID_ARGUMENT,"Type does not match the expected instance. Did you pass a reference from a different Firestore SDK?");{const t=Ui(n);throw new b(P.INVALID_ARGUMENT,`Expected type '${e.name}', but it was: ${t}`)}}return n}function Zy(n,e){if(e<=0)throw new b(P.INVALID_ARGUMENT,`Function ${n}() requires a positive number, but it was: ${e}.`)}/**
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
 */class ou{constructor(e){var t,r;if(e.host===void 0){if(e.ssl!==void 0)throw new b(P.INVALID_ARGUMENT,"Can't provide ssl option if host option is not set");this.host="firestore.googleapis.com",this.ssl=!0}else this.host=e.host,this.ssl=(t=e.ssl)===null||t===void 0||t;if(this.credentials=e.credentials,this.ignoreUndefinedProperties=!!e.ignoreUndefinedProperties,this.localCache=e.localCache,e.cacheSizeBytes===void 0)this.cacheSizeBytes=41943040;else{if(e.cacheSizeBytes!==-1&&e.cacheSizeBytes<1048576)throw new b(P.INVALID_ARGUMENT,"cacheSizeBytes must be at least 1048576");this.cacheSizeBytes=e.cacheSizeBytes}Eh("experimentalForceLongPolling",e.experimentalForceLongPolling,"experimentalAutoDetectLongPolling",e.experimentalAutoDetectLongPolling),this.experimentalForceLongPolling=!!e.experimentalForceLongPolling,this.experimentalForceLongPolling?this.experimentalAutoDetectLongPolling=!1:e.experimentalAutoDetectLongPolling===void 0?this.experimentalAutoDetectLongPolling=!0:this.experimentalAutoDetectLongPolling=!!e.experimentalAutoDetectLongPolling,this.experimentalLongPollingOptions=yh((r=e.experimentalLongPollingOptions)!==null&&r!==void 0?r:{}),(function(o){if(o.timeoutSeconds!==void 0){if(isNaN(o.timeoutSeconds))throw new b(P.INVALID_ARGUMENT,`invalid long polling timeout: ${o.timeoutSeconds} (must not be NaN)`);if(o.timeoutSeconds<5)throw new b(P.INVALID_ARGUMENT,`invalid long polling timeout: ${o.timeoutSeconds} (minimum allowed value is 5)`);if(o.timeoutSeconds>30)throw new b(P.INVALID_ARGUMENT,`invalid long polling timeout: ${o.timeoutSeconds} (maximum allowed value is 30)`)}})(this.experimentalLongPollingOptions),this.useFetchStreams=!!e.useFetchStreams}isEqual(e){return this.host===e.host&&this.ssl===e.ssl&&this.credentials===e.credentials&&this.cacheSizeBytes===e.cacheSizeBytes&&this.experimentalForceLongPolling===e.experimentalForceLongPolling&&this.experimentalAutoDetectLongPolling===e.experimentalAutoDetectLongPolling&&(function(r,i){return r.timeoutSeconds===i.timeoutSeconds})(this.experimentalLongPollingOptions,e.experimentalLongPollingOptions)&&this.ignoreUndefinedProperties===e.ignoreUndefinedProperties&&this.useFetchStreams===e.useFetchStreams}}class Bi{constructor(e,t,r,i){this._authCredentials=e,this._appCheckCredentials=t,this._databaseId=r,this._app=i,this.type="firestore-lite",this._persistenceKey="(lite)",this._settings=new ou({}),this._settingsFrozen=!1}get app(){if(!this._app)throw new b(P.FAILED_PRECONDITION,"Firestore was not initialized using the Firebase SDK. 'app' is not available");return this._app}get _initialized(){return this._settingsFrozen}get _terminated(){return this._terminateTask!==void 0}_setSettings(e){if(this._settingsFrozen)throw new b(P.FAILED_PRECONDITION,"Firestore has already been started and its settings can no longer be changed. You can only modify settings before calling any other methods on a Firestore object.");this._settings=new ou(e),e.credentials!==void 0&&(this._authCredentials=(function(r){if(!r)return new yl;switch(r.type){case"firstParty":return new Ig(r.sessionIndex||"0",r.iamToken||null,r.authTokenFactory||null);case"provider":return r.client;default:throw new b(P.INVALID_ARGUMENT,"makeAuthCredentialsProvider failed due to invalid credential type")}})(e.credentials))}_getSettings(){return this._settings}_freezeSettings(){return this._settingsFrozen=!0,this._settings}_delete(){return this._terminateTask||(this._terminateTask=this._terminate()),this._terminateTask}toJSON(){return{app:this._app,databaseId:this._databaseId,settings:this._settings}}_terminate(){return(function(t){const r=ru.get(t);r&&(O("ComponentProvider","Removing Datastore"),ru.delete(t),r.terminate())})(this),Promise.resolve()}}function Ih(n,e,t,r={}){var i;const o=(n=me(n,Bi))._getSettings(),a=`${e}:${t}`;if(o.host!=="firestore.googleapis.com"&&o.host!==a&&xt("Host has been set in both settings() and connectFirestoreEmulator(), emulator host will be used."),n._setSettings(Object.assign(Object.assign({},o),{host:a,ssl:!1})),r.mockUserToken){let u,l;if(typeof r.mockUserToken=="string")u=r.mockUserToken,l=we.MOCK_USER;else{u=Rd(r.mockUserToken,(i=n._app)===null||i===void 0?void 0:i.options.projectId);const d=r.mockUserToken.sub||r.mockUserToken.user_id;if(!d)throw new b(P.INVALID_ARGUMENT,"mockUserToken must contain 'sub' or 'user_id' field!");l=new we(d)}n._authCredentials=new yg(new _l(u,l))}}/**
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
 */class Fe{constructor(e,t,r){this.converter=t,this._query=r,this.type="query",this.firestore=e}withConverter(e){return new Fe(this.firestore,e,this._query)}}class he{constructor(e,t,r){this.converter=t,this._key=r,this.type="document",this.firestore=e}get _path(){return this._key.path}get id(){return this._key.path.lastSegment()}get path(){return this._key.path.canonicalString()}get parent(){return new rt(this.firestore,this.converter,this._key.path.popLast())}withConverter(e){return new he(this.firestore,e,this._key)}}class rt extends Fe{constructor(e,t,r){super(e,t,ki(r)),this._path=r,this.type="collection"}get id(){return this._query.path.lastSegment()}get path(){return this._query.path.canonicalString()}get parent(){const e=this._path.popLast();return e.isEmpty()?null:new he(this.firestore,null,new M(e))}withConverter(e){return new rt(this.firestore,e,this._path)}}function ev(n,e,...t){if(n=Q(n),vh("collection","path",e),n instanceof Bi){const r=Y.fromString(e,...t);return su(r),new rt(n,null,r)}{if(!(n instanceof he||n instanceof rt))throw new b(P.INVALID_ARGUMENT,"Expected first argument to collection() to be a CollectionReference, a DocumentReference or FirebaseFirestore");const r=n._path.child(Y.fromString(e,...t));return su(r),new rt(n.firestore,null,r)}}function Th(n,e,...t){if(n=Q(n),arguments.length===1&&(e=po.newId()),vh("doc","path",e),n instanceof Bi){const r=Y.fromString(e,...t);return iu(r),new he(n,null,new M(r))}{if(!(n instanceof he||n instanceof rt))throw new b(P.INVALID_ARGUMENT,"Expected first argument to collection() to be a CollectionReference, a DocumentReference or FirebaseFirestore");const r=n._path.child(Y.fromString(e,...t));return iu(r),new he(n.firestore,n instanceof rt?n.converter:null,new M(r))}}/**
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
 */class tv{constructor(){this.iu=Promise.resolve(),this.su=[],this.ou=!1,this._u=[],this.au=null,this.uu=!1,this.cu=!1,this.lu=[],this.Yo=new Co(this,"async_queue_retry"),this.hu=()=>{const t=ks();t&&O("AsyncQueue","Visibility state changed to "+t.visibilityState),this.Yo.Wo()};const e=ks();e&&typeof e.addEventListener=="function"&&e.addEventListener("visibilitychange",this.hu)}get isShuttingDown(){return this.ou}enqueueAndForget(e){this.enqueue(e)}enqueueAndForgetEvenWhileRestricted(e){this.Pu(),this.Iu(e)}enterRestrictedMode(e){if(!this.ou){this.ou=!0,this.cu=e||!1;const t=ks();t&&typeof t.removeEventListener=="function"&&t.removeEventListener("visibilitychange",this.hu)}}enqueue(e){if(this.Pu(),this.ou)return new Promise((()=>{}));const t=new qe;return this.Iu((()=>this.ou&&this.cu?Promise.resolve():(e().then(t.resolve,t.reject),t.promise))).then((()=>t.promise))}enqueueRetryable(e){this.enqueueAndForget((()=>(this.su.push(e),this.Tu())))}async Tu(){if(this.su.length!==0){try{await this.su[0](),this.su.shift(),this.Yo.reset()}catch(e){if(!yr(e))throw e;O("AsyncQueue","Operation failed with retryable error: "+e)}this.su.length>0&&this.Yo.$o((()=>this.Tu()))}}Iu(e){const t=this.iu.then((()=>(this.uu=!0,e().catch((r=>{this.au=r,this.uu=!1;const i=(function(a){let u=a.message||"";return a.stack&&(u=a.stack.includes(a.message)?a.stack:a.message+`
`+a.stack),u})(r);throw st("INTERNAL UNHANDLED ERROR: ",i),r})).then((r=>(this.uu=!1,r))))));return this.iu=t,t}enqueueAfterDelay(e,t,r){this.Pu(),this.lu.indexOf(e)>-1&&(t=0);const i=No.createAndSchedule(this,e,t,r,(o=>this.Eu(o)));return this._u.push(i),i}Pu(){this.au&&x()}verifyOperationInProgress(){}async du(){let e;do e=this.iu,await e;while(e!==this.iu)}Au(e){for(const t of this._u)if(t.timerId===e)return!0;return!1}Ru(e){return this.du().then((()=>{this._u.sort(((t,r)=>t.targetTimeMs-r.targetTimeMs));for(const t of this._u)if(t.skipDelay(),e!=="all"&&t.timerId===e)break;return this.du()}))}Vu(e){this.lu.push(e)}Eu(e){const t=this._u.indexOf(e);this._u.splice(t,1)}}function au(n){return(function(t,r){if(typeof t!="object"||t===null)return!1;const i=t;for(const o of r)if(o in i&&typeof i[o]=="function")return!0;return!1})(n,["next","error","complete"])}class Oe extends Bi{constructor(e,t,r,i){super(e,t,r,i),this.type="firestore",this._queue=(function(){return new tv})(),this._persistenceKey=i?.name||"[DEFAULT]"}_terminate(){return this._firestoreClient||wh(this),this._firestoreClient.terminate()}}function nv(n,e,t){t||(t="(default)");const r=Ii(n,"firestore");if(r.isInitialized(t)){const i=r.getImmediate({identifier:t}),o=r.getOptions(t);if(an(o,e))return i;throw new b(P.FAILED_PRECONDITION,"initializeFirestore() has already been called with different options. To avoid this error, call initializeFirestore() with the same options as when it was originally called, or call getFirestore() to return the already initialized instance.")}if(e.cacheSizeBytes!==void 0&&e.localCache!==void 0)throw new b(P.INVALID_ARGUMENT,"cache and cacheSizeBytes cannot be specified at the same time as cacheSizeBytes willbe deprecated. Instead, specify the cache size in the cache object");if(e.cacheSizeBytes!==void 0&&e.cacheSizeBytes!==-1&&e.cacheSizeBytes<1048576)throw new b(P.INVALID_ARGUMENT,"cacheSizeBytes must be at least 1048576");return r.initialize({options:e,instanceIdentifier:t})}function rv(n,e){const t=typeof n=="object"?n:yu(),r=typeof n=="string"?n:e||"(default)",i=Ii(t,"firestore").getImmediate({identifier:r});if(!i._initialized){const o=wd("firestore");o&&Ih(i,...o)}return i}function zt(n){return n._firestoreClient||wh(n),n._firestoreClient.verifyNotTerminated(),n._firestoreClient}function wh(n){var e,t,r;const i=n._freezeSettings(),o=(function(u,l,d,p){return new Og(u,l,d,p.host,p.ssl,p.experimentalForceLongPolling,p.experimentalAutoDetectLongPolling,yh(p.experimentalLongPollingOptions),p.useFetchStreams)})(n._databaseId,((e=n._app)===null||e===void 0?void 0:e.options.appId)||"",n._persistenceKey,i);n._firestoreClient=new Gy(n._authCredentials,n._appCheckCredentials,n._queue,o),!((t=i.localCache)===null||t===void 0)&&t._offlineComponentProvider&&(!((r=i.localCache)===null||r===void 0)&&r._onlineComponentProvider)&&(n._firestoreClient._uninitializedComponentsProvider={_offlineKind:i.localCache.kind,_offline:i.localCache._offlineComponentProvider,_online:i.localCache._onlineComponentProvider})}/**
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
 */class wt{constructor(e){this._byteString=e}static fromBase64String(e){try{return new wt(_e.fromBase64String(e))}catch(t){throw new b(P.INVALID_ARGUMENT,"Failed to construct data from Base64 string: "+t)}}static fromUint8Array(e){return new wt(_e.fromUint8Array(e))}toBase64(){return this._byteString.toBase64()}toUint8Array(){return this._byteString.toUint8Array()}toString(){return"Bytes(base64: "+this.toBase64()+")"}isEqual(e){return this._byteString.isEqual(e._byteString)}}/**
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
 */class Wt{constructor(...e){for(let t=0;t<e.length;++t)if(e[t].length===0)throw new b(P.INVALID_ARGUMENT,"Invalid field name at argument $(i + 1). Field names must not be empty.");this._internalPath=new le(e)}isEqual(e){return this._internalPath.isEqual(e._internalPath)}}/**
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
 */class Gt{constructor(e){this._methodName=e}}/**
 * @license
 * Copyright 2017 Google LLC
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
 */class qi{constructor(e,t){if(!isFinite(e)||e<-90||e>90)throw new b(P.INVALID_ARGUMENT,"Latitude must be a number between -90 and 90, but was: "+e);if(!isFinite(t)||t<-180||t>180)throw new b(P.INVALID_ARGUMENT,"Longitude must be a number between -180 and 180, but was: "+t);this._lat=e,this._long=t}get latitude(){return this._lat}get longitude(){return this._long}isEqual(e){return this._lat===e._lat&&this._long===e._long}toJSON(){return{latitude:this._lat,longitude:this._long}}_compareTo(e){return G(this._lat,e._lat)||G(this._long,e._long)}}/**
 * @license
 * Copyright 2017 Google LLC
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
 */const iv=/^__.*__$/;class sv{constructor(e,t,r){this.data=e,this.fieldMask=t,this.fieldTransforms=r}toMutation(e,t){return this.fieldMask!==null?new At(e,this.data,this.fieldMask,t,this.fieldTransforms):new Er(e,this.data,t,this.fieldTransforms)}}class Ah{constructor(e,t,r){this.data=e,this.fieldMask=t,this.fieldTransforms=r}toMutation(e,t){return new At(e,this.data,this.fieldMask,t,this.fieldTransforms)}}function Rh(n){switch(n){case 0:case 2:case 1:return!0;case 3:case 4:return!1;default:throw x()}}class ji{constructor(e,t,r,i,o,a){this.settings=e,this.databaseId=t,this.serializer=r,this.ignoreUndefinedProperties=i,o===void 0&&this.mu(),this.fieldTransforms=o||[],this.fieldMask=a||[]}get path(){return this.settings.path}get fu(){return this.settings.fu}gu(e){return new ji(Object.assign(Object.assign({},this.settings),e),this.databaseId,this.serializer,this.ignoreUndefinedProperties,this.fieldTransforms,this.fieldMask)}pu(e){var t;const r=(t=this.path)===null||t===void 0?void 0:t.child(e),i=this.gu({path:r,yu:!1});return i.wu(e),i}Su(e){var t;const r=(t=this.path)===null||t===void 0?void 0:t.child(e),i=this.gu({path:r,yu:!1});return i.mu(),i}bu(e){return this.gu({path:void 0,yu:!0})}Du(e){return vi(e,this.settings.methodName,this.settings.Cu||!1,this.path,this.settings.vu)}contains(e){return this.fieldMask.find((t=>e.isPrefixOf(t)))!==void 0||this.fieldTransforms.find((t=>e.isPrefixOf(t.field)))!==void 0}mu(){if(this.path)for(let e=0;e<this.path.length;e++)this.wu(this.path.get(e))}wu(e){if(e.length===0)throw this.Du("Document fields must not be empty");if(Rh(this.fu)&&iv.test(e))throw this.Du('Document fields cannot begin and end with "__"')}}class ov{constructor(e,t,r){this.databaseId=e,this.ignoreUndefinedProperties=t,this.serializer=r||Li(e)}Fu(e,t,r,i=!1){return new ji({fu:e,methodName:t,vu:r,path:le.emptyPath(),yu:!1,Cu:i},this.databaseId,this.serializer,this.ignoreUndefinedProperties)}}function Ht(n){const e=n._freezeSettings(),t=Li(n._databaseId);return new ov(n._databaseId,!!e.ignoreUndefinedProperties,t)}function $i(n,e,t,r,i,o={}){const a=n.Fu(o.merge||o.mergeFields?2:0,e,t,i);Ho("Data must be an object, but it was:",a,r);const u=Sh(r,a);let l,d;if(o.merge)l=new be(a.fieldMask),d=a.fieldTransforms;else if(o.mergeFields){const p=[];for(const y of o.mergeFields){const T=Zs(e,y,t);if(!a.contains(T))throw new b(P.INVALID_ARGUMENT,`Field '${T}' is specified in your field mask but missing from your input data.`);bh(p,T)||p.push(T)}l=new be(p),d=a.fieldTransforms.filter((y=>l.covers(y.field)))}else l=null,d=a.fieldTransforms;return new sv(new Pe(u),l,d)}class Rr extends Gt{_toFieldTransform(e){if(e.fu!==2)throw e.fu===1?e.Du(`${this._methodName}() can only appear at the top level of your update data`):e.Du(`${this._methodName}() cannot be used with set() unless you pass {merge:true}`);return e.fieldMask.push(e.path),null}isEqual(e){return e instanceof Rr}}function av(n,e,t){return new ji({fu:3,vu:e.settings.vu,methodName:n._methodName,yu:t},e.databaseId,e.serializer,e.ignoreUndefinedProperties)}class jo extends Gt{_toFieldTransform(e){return new Io(e.path,new ur)}isEqual(e){return e instanceof jo}}class $o extends Gt{constructor(e,t){super(e),this.Mu=t}_toFieldTransform(e){const t=av(this,e,!0),r=this.Mu.map((o=>An(o,t))),i=new mn(r);return new Io(e.path,i)}isEqual(e){return e instanceof $o&&an(this.Mu,e.Mu)}}class zo extends Gt{constructor(e,t){super(e),this.xu=t}_toFieldTransform(e){const t=new hr(e.serializer,Ml(e.serializer,this.xu));return new Io(e.path,t)}isEqual(e){return e instanceof zo&&this.xu===e.xu}}function Wo(n,e,t,r){const i=n.Fu(1,e,t);Ho("Data must be an object, but it was:",i,r);const o=[],a=Pe.empty();qt(r,((l,d)=>{const p=Ko(e,l,t);d=Q(d);const y=i.Su(p);if(d instanceof Rr)o.push(p);else{const T=An(d,y);T!=null&&(o.push(p),a.set(p,T))}}));const u=new be(o);return new Ah(a,u,i.fieldTransforms)}function Go(n,e,t,r,i,o){const a=n.Fu(1,e,t),u=[Zs(e,r,t)],l=[i];if(o.length%2!=0)throw new b(P.INVALID_ARGUMENT,`Function ${e}() needs to be called with an even number of arguments that alternate between field names and values.`);for(let T=0;T<o.length;T+=2)u.push(Zs(e,o[T])),l.push(o[T+1]);const d=[],p=Pe.empty();for(let T=u.length-1;T>=0;--T)if(!bh(d,u[T])){const S=u[T];let V=l[T];V=Q(V);const N=a.Su(S);if(V instanceof Rr)d.push(S);else{const k=An(V,N);k!=null&&(d.push(S),p.set(S,k))}}const y=new be(d);return new Ah(p,y,a.fieldTransforms)}function Ph(n,e,t,r=!1){return An(t,n.Fu(r?4:3,e))}function An(n,e){if(Ch(n=Q(n)))return Ho("Unsupported field value:",e,n),Sh(n,e);if(n instanceof Gt)return(function(r,i){if(!Rh(i.fu))throw i.Du(`${r._methodName}() can only be used with update() and set()`);if(!i.path)throw i.Du(`${r._methodName}() is not currently supported inside arrays`);const o=r._toFieldTransform(i);o&&i.fieldTransforms.push(o)})(n,e),null;if(n===void 0&&e.ignoreUndefinedProperties)return null;if(e.path&&e.fieldMask.push(e.path),n instanceof Array){if(e.settings.yu&&e.fu!==4)throw e.Du("Nested arrays are not supported");return(function(r,i){const o=[];let a=0;for(const u of r){let l=An(u,i.bu(a));l==null&&(l={nullValue:"NULL_VALUE"}),o.push(l),a++}return{arrayValue:{values:o}}})(n,e)}return(function(r,i){if((r=Q(r))===null)return{nullValue:"NULL_VALUE"};if(typeof r=="number")return Ml(i.serializer,r);if(typeof r=="boolean")return{booleanValue:r};if(typeof r=="string")return{stringValue:r};if(r instanceof Date){const o=ae.fromDate(r);return{timestampValue:mi(i.serializer,o)}}if(r instanceof ae){const o=new ae(r.seconds,1e3*Math.floor(r.nanoseconds/1e3));return{timestampValue:mi(i.serializer,o)}}if(r instanceof qi)return{geoPointValue:{latitude:r.latitude,longitude:r.longitude}};if(r instanceof wt)return{bytesValue:Hl(i.serializer,r._byteString)};if(r instanceof he){const o=i.databaseId,a=r.firestore._databaseId;if(!a.isEqual(o))throw i.Du(`Document reference is for database ${a.projectId}/${a.database} but should be for database ${o.projectId}/${o.database}`);return{referenceValue:Ao(r.firestore._databaseId||i.databaseId,r._key.path)}}throw i.Du(`Unsupported field value: ${Ui(r)}`)})(n,e)}function Sh(n,e){const t={};return vl(n)?e.path&&e.path.length>0&&e.fieldMask.push(e.path):qt(n,((r,i)=>{const o=An(i,e.pu(r));o!=null&&(t[r]=o)})),{mapValue:{fields:t}}}function Ch(n){return!(typeof n!="object"||n===null||n instanceof Array||n instanceof Date||n instanceof ae||n instanceof qi||n instanceof wt||n instanceof he||n instanceof Gt)}function Ho(n,e,t){if(!Ch(t)||!(function(i){return typeof i=="object"&&i!==null&&(Object.getPrototypeOf(i)===Object.prototype||Object.getPrototypeOf(i)===null)})(t)){const r=Ui(t);throw r==="an object"?e.Du(n+" a custom object"):e.Du(n+" "+r)}}function Zs(n,e,t){if((e=Q(e))instanceof Wt)return e._internalPath;if(typeof e=="string")return Ko(n,e);throw vi("Field path arguments must be of type string or ",n,!1,void 0,t)}const cv=new RegExp("[~\\*/\\[\\]]");function Ko(n,e,t){if(e.search(cv)>=0)throw vi(`Invalid field path (${e}). Paths must not contain '~', '*', '/', '[', or ']'`,n,!1,void 0,t);try{return new Wt(...e.split("."))._internalPath}catch{throw vi(`Invalid field path (${e}). Paths must not be empty, begin with '.', end with '.', or contain '..'`,n,!1,void 0,t)}}function vi(n,e,t,r,i){const o=r&&!r.isEmpty(),a=i!==void 0;let u=`Function ${e}() called with invalid data`;t&&(u+=" (via `toFirestore()`)"),u+=". ";let l="";return(o||a)&&(l+=" (found",o&&(l+=` in field ${r}`),a&&(l+=` in document ${i}`),l+=")"),new b(P.INVALID_ARGUMENT,u+n+l)}function bh(n,e){return n.some((t=>t.isEqual(e)))}/**
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
 */class dr{constructor(e,t,r,i,o){this._firestore=e,this._userDataWriter=t,this._key=r,this._document=i,this._converter=o}get id(){return this._key.path.lastSegment()}get ref(){return new he(this._firestore,this._converter,this._key)}exists(){return this._document!==null}data(){if(this._document){if(this._converter){const e=new uv(this._firestore,this._userDataWriter,this._key,this._document,null);return this._converter.fromFirestore(e)}return this._userDataWriter.convertValue(this._document.data.value)}}get(e){if(this._document){const t=this._document.data.field(zi("DocumentSnapshot.get",e));if(t!==null)return this._userDataWriter.convertValue(t)}}}class uv extends dr{data(){return super.data()}}function zi(n,e){return typeof e=="string"?Ko(n,e):e instanceof Wt?e._internalPath:e._delegate._internalPath}/**
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
 */function kh(n){if(n.limitType==="L"&&n.explicitOrderBy.length===0)throw new b(P.UNIMPLEMENTED,"limitToLast() queries require specifying at least one orderBy() clause")}class Qo{}class Pr extends Qo{}function lv(n,e,...t){let r=[];e instanceof Qo&&r.push(e),r=r.concat(t),(function(o){const a=o.filter((l=>l instanceof Wi)).length,u=o.filter((l=>l instanceof Sr)).length;if(a>1||a>0&&u>0)throw new b(P.INVALID_ARGUMENT,"InvalidQuery. When using composite filters, you cannot use more than one filter at the top level. Consider nesting the multiple filters within an `and(...)` statement. For example: change `query(query, where(...), or(...))` to `query(query, and(where(...), or(...)))`.")})(r);for(const i of r)n=i._apply(n);return n}class Sr extends Pr{constructor(e,t,r){super(),this._field=e,this._op=t,this._value=r,this.type="where"}static _create(e,t,r){return new Sr(e,t,r)}_apply(e){const t=this._parse(e);return Dh(e._query,t),new Fe(e.firestore,e.converter,Gs(e._query,t))}_parse(e){const t=Ht(e.firestore);return(function(o,a,u,l,d,p,y){let T;if(d.isKeyField()){if(p==="array-contains"||p==="array-contains-any")throw new b(P.INVALID_ARGUMENT,`Invalid Query. You can't perform '${p}' queries on documentId().`);if(p==="in"||p==="not-in"){uu(y,p);const S=[];for(const V of y)S.push(cu(l,o,V));T={arrayValue:{values:S}}}else T=cu(l,o,y)}else p!=="in"&&p!=="not-in"&&p!=="array-contains-any"||uu(y,p),T=Ph(u,a,y,p==="in"||p==="not-in");return se.create(d,p,T)})(e._query,"where",t,e.firestore._databaseId,this._field,this._op,this._value)}}function hv(n,e,t){const r=e,i=zi("where",n);return Sr._create(i,r,t)}class Wi extends Qo{constructor(e,t){super(),this.type=e,this._queryConstraints=t}static _create(e,t){return new Wi(e,t)}_parse(e){const t=this._queryConstraints.map((r=>r._parse(e))).filter((r=>r.getFilters().length>0));return t.length===1?t[0]:Le.create(t,this._getOperator())}_apply(e){const t=this._parse(e);return t.getFilters().length===0?e:((function(i,o){let a=i;const u=o.getFlattenedFilters();for(const l of u)Dh(a,l),a=Gs(a,l)})(e._query,t),new Fe(e.firestore,e.converter,Gs(e._query,t)))}_getQueryConstraints(){return this._queryConstraints}_getOperator(){return this.type==="and"?"and":"or"}}class Gi extends Pr{constructor(e,t){super(),this._field=e,this._direction=t,this.type="orderBy"}static _create(e,t){return new Gi(e,t)}_apply(e){const t=(function(i,o,a){if(i.startAt!==null)throw new b(P.INVALID_ARGUMENT,"Invalid query. You must not call startAt() or startAfter() before calling orderBy().");if(i.endAt!==null)throw new b(P.INVALID_ARGUMENT,"Invalid query. You must not call endAt() or endBefore() before calling orderBy().");return new cr(o,a)})(e._query,this._field,this._direction);return new Fe(e.firestore,e.converter,(function(i,o){const a=i.explicitOrderBy.concat([o]);return new jt(i.path,i.collectionGroup,a,i.filters.slice(),i.limit,i.limitType,i.startAt,i.endAt)})(e._query,t))}}function dv(n,e="asc"){const t=e,r=zi("orderBy",n);return Gi._create(r,t)}class Hi extends Pr{constructor(e,t,r){super(),this.type=e,this._limit=t,this._limitType=r}static _create(e,t,r){return new Hi(e,t,r)}_apply(e){return new Fe(e.firestore,e.converter,pi(e._query,this._limit,this._limitType))}}function fv(n){return Zy("limit",n),Hi._create("limit",n,"F")}class Ki extends Pr{constructor(e,t,r){super(),this.type=e,this._docOrFields=t,this._inclusive=r}static _create(e,t,r){return new Ki(e,t,r)}_apply(e){const t=mv(e,this.type,this._docOrFields,this._inclusive);return new Fe(e.firestore,e.converter,(function(i,o){return new jt(i.path,i.collectionGroup,i.explicitOrderBy.slice(),i.filters.slice(),i.limit,i.limitType,o,i.endAt)})(e._query,t))}}function pv(...n){return Ki._create("startAfter",n,!1)}function mv(n,e,t,r){if(t[0]=Q(t[0]),t[0]instanceof dr)return(function(o,a,u,l,d){if(!l)throw new b(P.NOT_FOUND,`Can't use a DocumentSnapshot that doesn't exist for ${u}().`);const p=[];for(const y of sn(o))if(y.field.isKeyField())p.push(fi(a,l.key));else{const T=l.data.field(y.field);if(bi(T))throw new b(P.INVALID_ARGUMENT,'Invalid query. You are trying to start or end a query using a document for which the field "'+y.field+'" is an uncommitted server timestamp. (Since the value of this field is unknown, you cannot start/end a query with it.)');if(T===null){const S=y.field.canonicalString();throw new b(P.INVALID_ARGUMENT,`Invalid query. You are trying to start or end a query using a document for which the field '${S}' (used as the orderBy) does not exist.`)}p.push(T)}return new pn(p,d)})(n._query,n.firestore._databaseId,e,t[0]._document,r);{const i=Ht(n.firestore);return(function(a,u,l,d,p,y){const T=a.explicitOrderBy;if(p.length>T.length)throw new b(P.INVALID_ARGUMENT,`Too many arguments provided to ${d}(). The number of arguments must be less than or equal to the number of orderBy() clauses`);const S=[];for(let V=0;V<p.length;V++){const N=p[V];if(T[V].field.isKeyField()){if(typeof N!="string")throw new b(P.INVALID_ARGUMENT,`Invalid query. Expected a string for document ID in ${d}(), but got a ${typeof N}`);if(!Eo(a)&&N.indexOf("/")!==-1)throw new b(P.INVALID_ARGUMENT,`Invalid query. When querying a collection and ordering by documentId(), the value passed to ${d}() must be a plain document ID, but '${N}' contains a slash.`);const k=a.path.child(Y.fromString(N));if(!M.isDocumentKey(k))throw new b(P.INVALID_ARGUMENT,`Invalid query. When querying a collection group and ordering by documentId(), the value passed to ${d}() must result in a valid document path, but '${k}' is not because it contains an odd number of segments.`);const B=new M(k);S.push(fi(u,B))}else{const k=Ph(l,d,N);S.push(k)}}return new pn(S,y)})(n._query,n.firestore._databaseId,i,e,t,r)}}function cu(n,e,t){if(typeof(t=Q(t))=="string"){if(t==="")throw new b(P.INVALID_ARGUMENT,"Invalid query. When querying with documentId(), you must provide a valid document ID, but it was an empty string.");if(!Eo(e)&&t.indexOf("/")!==-1)throw new b(P.INVALID_ARGUMENT,`Invalid query. When querying a collection by documentId(), you must provide a plain document ID, but '${t}' contains a '/' character.`);const r=e.path.child(Y.fromString(t));if(!M.isDocumentKey(r))throw new b(P.INVALID_ARGUMENT,`Invalid query. When querying a collection group by documentId(), the value provided must result in a valid document path, but '${r}' is not because it has an odd number of segments (${r.length}).`);return fi(n,new M(r))}if(t instanceof he)return fi(n,t._key);throw new b(P.INVALID_ARGUMENT,`Invalid query. When querying with documentId(), you must provide a valid string or a DocumentReference, but it was: ${Ui(t)}.`)}function uu(n,e){if(!Array.isArray(n)||n.length===0)throw new b(P.INVALID_ARGUMENT,`Invalid Query. A non-empty array is required for '${e.toString()}' filters.`)}function Dh(n,e){const t=(function(i,o){for(const a of i)for(const u of a.getFlattenedFilters())if(o.indexOf(u.op)>=0)return u.op;return null})(n.filters,(function(i){switch(i){case"!=":return["!=","not-in"];case"array-contains-any":case"in":return["not-in"];case"not-in":return["array-contains-any","in","not-in","!="];default:return[]}})(e.op));if(t!==null)throw t===e.op?new b(P.INVALID_ARGUMENT,`Invalid query. You cannot use more than one '${e.op.toString()}' filter.`):new b(P.INVALID_ARGUMENT,`Invalid query. You cannot use '${e.op.toString()}' filters with '${t.toString()}' filters.`)}class Yo{convertValue(e,t="none"){switch(Ut(e)){case 0:return null;case 1:return e.booleanValue;case 2:return ie(e.integerValue||e.doubleValue);case 3:return this.convertTimestamp(e.timestampValue);case 4:return this.convertServerTimestamp(e,t);case 5:return e.stringValue;case 6:return this.convertBytes(Ft(e.bytesValue));case 7:return this.convertReference(e.referenceValue);case 8:return this.convertGeoPoint(e.geoPointValue);case 9:return this.convertArray(e.arrayValue,t);case 10:return this.convertObject(e.mapValue,t);default:throw x()}}convertObject(e,t){return this.convertObjectMap(e.fields,t)}convertObjectMap(e,t="none"){const r={};return qt(e,((i,o)=>{r[i]=this.convertValue(o,t)})),r}convertGeoPoint(e){return new qi(ie(e.latitude),ie(e.longitude))}convertArray(e,t){return(e.values||[]).map((r=>this.convertValue(r,t)))}convertServerTimestamp(e,t){switch(t){case"previous":const r=go(e);return r==null?null:this.convertValue(r,t);case"estimate":return this.convertTimestamp(or(e));default:return null}}convertTimestamp(e){const t=It(e);return new ae(t.seconds,t.nanos)}convertDocumentKey(e,t){const r=Y.fromString(e);K(eh(r));const i=new hn(r.get(1),r.get(3)),o=new M(r.popFirst(5));return i.isEqual(t)||st(`Document ${o} contains a document reference within a different database (${i.projectId}/${i.database}) which is not supported. It will be treated as a reference in the current database (${t.projectId}/${t.database}) instead.`),o}}/**
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
 */function Qi(n,e,t){let r;return r=n?t&&(t.merge||t.mergeFields)?n.toFirestore(e,t):n.toFirestore(e):e,r}class gv extends Yo{constructor(e){super(),this.firestore=e}convertBytes(e){return new wt(e)}convertReference(e){const t=this.convertDocumentKey(e,this.firestore._databaseId);return new he(this.firestore,null,t)}}/**
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
 */class Dt{constructor(e,t){this.hasPendingWrites=e,this.fromCache=t}isEqual(e){return this.hasPendingWrites===e.hasPendingWrites&&this.fromCache===e.fromCache}}class Yi extends dr{constructor(e,t,r,i,o,a){super(e,t,r,i,a),this._firestore=e,this._firestoreImpl=e,this.metadata=o}exists(){return super.exists()}data(e={}){if(this._document){if(this._converter){const t=new nr(this._firestore,this._userDataWriter,this._key,this._document,this.metadata,null);return this._converter.fromFirestore(t,e)}return this._userDataWriter.convertValue(this._document.data.value,e.serverTimestamps)}}get(e,t={}){if(this._document){const r=this._document.data.field(zi("DocumentSnapshot.get",e));if(r!==null)return this._userDataWriter.convertValue(r,t.serverTimestamps)}}}class nr extends Yi{data(e={}){return super.data(e)}}class Xo{constructor(e,t,r,i){this._firestore=e,this._userDataWriter=t,this._snapshot=i,this.metadata=new Dt(i.hasPendingWrites,i.fromCache),this.query=r}get docs(){const e=[];return this.forEach((t=>e.push(t))),e}get size(){return this._snapshot.docs.size}get empty(){return this.size===0}forEach(e,t){this._snapshot.docs.forEach((r=>{e.call(t,new nr(this._firestore,this._userDataWriter,r.key,r,new Dt(this._snapshot.mutatedKeys.has(r.key),this._snapshot.fromCache),this.query.converter))}))}docChanges(e={}){const t=!!e.includeMetadataChanges;if(t&&this._snapshot.excludesMetadataChanges)throw new b(P.INVALID_ARGUMENT,"To include metadata changes with your document changes, you must also pass { includeMetadataChanges:true } to onSnapshot().");return this._cachedChanges&&this._cachedChangesIncludeMetadataChanges===t||(this._cachedChanges=(function(i,o){if(i._snapshot.oldDocs.isEmpty()){let a=0;return i._snapshot.docChanges.map((u=>{const l=new nr(i._firestore,i._userDataWriter,u.doc.key,u.doc,new Dt(i._snapshot.mutatedKeys.has(u.doc.key),i._snapshot.fromCache),i.query.converter);return u.doc,{type:"added",doc:l,oldIndex:-1,newIndex:a++}}))}{let a=i._snapshot.oldDocs;return i._snapshot.docChanges.filter((u=>o||u.type!==3)).map((u=>{const l=new nr(i._firestore,i._userDataWriter,u.doc.key,u.doc,new Dt(i._snapshot.mutatedKeys.has(u.doc.key),i._snapshot.fromCache),i.query.converter);let d=-1,p=-1;return u.type!==0&&(d=a.indexOf(u.doc.key),a=a.delete(u.doc.key)),u.type!==1&&(a=a.add(u.doc),p=a.indexOf(u.doc.key)),{type:_v(u.type),doc:l,oldIndex:d,newIndex:p}}))}})(this,t),this._cachedChangesIncludeMetadataChanges=t),this._cachedChanges}}function _v(n){switch(n){case 0:return"added";case 2:case 3:return"modified";case 1:return"removed";default:return x()}}/**
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
 */function yv(n){n=me(n,he);const e=me(n.firestore,Oe);return Xy(zt(e),n._key).then((t=>Vh(e,n,t)))}class Xi extends Yo{constructor(e){super(),this.firestore=e}convertBytes(e){return new wt(e)}convertReference(e){const t=this.convertDocumentKey(e,this.firestore._databaseId);return new he(this.firestore,null,t)}}function vv(n){n=me(n,Fe);const e=me(n.firestore,Oe),t=zt(e),r=new Xi(e);return kh(n._query),Jy(t,n._query).then((i=>new Xo(e,r,n,i)))}function Ev(n,e,t){n=me(n,he);const r=me(n.firestore,Oe),i=Qi(n.converter,e,t);return Rn(r,[$i(Ht(r),"setDoc",n._key,i,n.converter!==null,t).toMutation(n._key,oe.none())])}function Iv(n,e,t,...r){n=me(n,he);const i=me(n.firestore,Oe),o=Ht(i);let a;return a=typeof(e=Q(e))=="string"||e instanceof Wt?Go(o,"updateDoc",n._key,e,t,r):Wo(o,"updateDoc",n._key,e),Rn(i,[a.toMutation(n._key,oe.exists(!0))])}function Tv(n){return Rn(me(n.firestore,Oe),[new Ir(n._key,oe.none())])}function wv(n,e){const t=me(n.firestore,Oe),r=Th(n),i=Qi(n.converter,e);return Rn(t,[$i(Ht(n.firestore),"addDoc",r._key,i,n.converter!==null,{}).toMutation(r._key,oe.exists(!1))]).then((()=>r))}function Av(n,...e){var t,r,i;n=Q(n);let o={includeMetadataChanges:!1,source:"default"},a=0;typeof e[a]!="object"||au(e[a])||(o=e[a],a++);const u={includeMetadataChanges:o.includeMetadataChanges,source:o.source};if(au(e[a])){const y=e[a];e[a]=(t=y.next)===null||t===void 0?void 0:t.bind(y),e[a+1]=(r=y.error)===null||r===void 0?void 0:r.bind(y),e[a+2]=(i=y.complete)===null||i===void 0?void 0:i.bind(y)}let l,d,p;if(n instanceof he)d=me(n.firestore,Oe),p=ki(n._key.path),l={next:y=>{e[a]&&e[a](Vh(d,n,y))},error:e[a+1],complete:e[a+2]};else{const y=me(n,Fe);d=me(y.firestore,Oe),p=y._query;const T=new Xi(d);l={next:S=>{e[a]&&e[a](new Xo(d,T,y,S))},error:e[a+1],complete:e[a+2]},kh(n._query)}return(function(T,S,V,N){const k=new Bo(N),B=new Fo(S,k,V);return T.asyncQueue.enqueueAndForget((async()=>Mo(await yi(T),B))),()=>{k.$a(),T.asyncQueue.enqueueAndForget((async()=>Lo(await yi(T),B)))}})(zt(d),p,u,l)}function Rn(n,e){return(function(r,i){const o=new qe;return r.asyncQueue.enqueueAndForget((async()=>My(await Qy(r),i,o))),o.promise})(zt(n),e)}function Vh(n,e,t){const r=t.docs.get(e._key),i=new Xi(n);return new Yi(n,i,e._key,r,new Dt(t.hasPendingWrites,t.fromCache),e.converter)}/**
 * @license
 * Copyright 2022 Google LLC
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
 */const Rv={maxAttempts:5};/**
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
 */class Nh{constructor(e,t){this._firestore=e,this._commitHandler=t,this._mutations=[],this._committed=!1,this._dataReader=Ht(e)}set(e,t,r){this._verifyNotCommitted();const i=ft(e,this._firestore),o=Qi(i.converter,t,r),a=$i(this._dataReader,"WriteBatch.set",i._key,o,i.converter!==null,r);return this._mutations.push(a.toMutation(i._key,oe.none())),this}update(e,t,r,...i){this._verifyNotCommitted();const o=ft(e,this._firestore);let a;return a=typeof(t=Q(t))=="string"||t instanceof Wt?Go(this._dataReader,"WriteBatch.update",o._key,t,r,i):Wo(this._dataReader,"WriteBatch.update",o._key,t),this._mutations.push(a.toMutation(o._key,oe.exists(!0))),this}delete(e){this._verifyNotCommitted();const t=ft(e,this._firestore);return this._mutations=this._mutations.concat(new Ir(t._key,oe.none())),this}commit(){return this._verifyNotCommitted(),this._committed=!0,this._mutations.length>0?this._commitHandler(this._mutations):Promise.resolve()}_verifyNotCommitted(){if(this._committed)throw new b(P.FAILED_PRECONDITION,"A write batch can no longer be used after commit() has been called.")}}function ft(n,e){if((n=Q(n)).firestore!==e)throw new b(P.INVALID_ARGUMENT,"Provided document reference is from a different Firestore instance.");return n}/**
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
 *//**
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
 */class Oh extends class{constructor(t,r){this._firestore=t,this._transaction=r,this._dataReader=Ht(t)}get(t){const r=ft(t,this._firestore),i=new gv(this._firestore);return this._transaction.lookup([r._key]).then((o=>{if(!o||o.length!==1)return x();const a=o[0];if(a.isFoundDocument())return new dr(this._firestore,i,a.key,a,r.converter);if(a.isNoDocument())return new dr(this._firestore,i,r._key,null,r.converter);throw x()}))}set(t,r,i){const o=ft(t,this._firestore),a=Qi(o.converter,r,i),u=$i(this._dataReader,"Transaction.set",o._key,a,o.converter!==null,i);return this._transaction.set(o._key,u),this}update(t,r,i,...o){const a=ft(t,this._firestore);let u;return u=typeof(r=Q(r))=="string"||r instanceof Wt?Go(this._dataReader,"Transaction.update",a._key,r,i,o):Wo(this._dataReader,"Transaction.update",a._key,r),this._transaction.update(a._key,u),this}delete(t){const r=ft(t,this._firestore);return this._transaction.delete(r._key),this}}{constructor(e,t){super(e,t),this._firestore=e}get(e){const t=ft(e,this._firestore),r=new Xi(this._firestore);return super.get(e).then((i=>new Yi(this._firestore,r,t._key,i._document,new Dt(!1,!1),t.converter)))}}function Pv(n,e,t){n=me(n,Oe);const r=Object.assign(Object.assign({},Rv),t);return(function(o){if(o.maxAttempts<1)throw new b(P.INVALID_ARGUMENT,"Max attempts must be at least 1")})(r),(function(o,a,u){const l=new qe;return o.asyncQueue.enqueueAndForget((async()=>{const d=await Yy(o);new Wy(o.asyncQueue,d,u,a,l).Xa()})),l.promise})(zt(n),(i=>e(new Oh(n,i))),r)}/**
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
 */function Sv(){return new Rr("deleteField")}function Cv(){return new jo("serverTimestamp")}function bv(...n){return new $o("arrayUnion",n)}function kv(n){return new zo("increment",n)}/**
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
 */function Dv(n){return zt(n=me(n,Oe)),new Nh(n,(e=>Rn(n,e)))}(function(e,t=!0){(function(i){In=i})(yn),cn(new Nt("firestore",((r,{instanceIdentifier:i,options:o})=>{const a=r.getProvider("app").getImmediate(),u=new Oe(new vg(r.getProvider("auth-internal")),new wg(r.getProvider("app-check-internal")),(function(d,p){if(!Object.prototype.hasOwnProperty.apply(d.options,["projectId"]))throw new b(P.INVALID_ARGUMENT,'"projectId" not provided in firebase.initializeApp.');return new hn(d.options.projectId,p)})(a,i),a);return o=Object.assign({useFetchStreams:t},o),u._setSettings(o),u}),"PUBLIC").setMultipleInstances(!0)),yt(Sc,"4.6.4",e),yt(Sc,"4.6.4","esm2017")})();const qv=Object.freeze(Object.defineProperty({__proto__:null,AbstractUserDataWriter:Yo,Bytes:wt,CollectionReference:rt,DocumentReference:he,DocumentSnapshot:Yi,FieldPath:Wt,FieldValue:Gt,Firestore:Oe,FirestoreError:b,GeoPoint:qi,Query:Fe,QueryCompositeFilterConstraint:Wi,QueryConstraint:Pr,QueryDocumentSnapshot:nr,QueryFieldFilterConstraint:Sr,QueryLimitConstraint:Hi,QueryOrderByConstraint:Gi,QuerySnapshot:Xo,QueryStartAtConstraint:Ki,SnapshotMetadata:Dt,Timestamp:ae,Transaction:Oh,WriteBatch:Nh,_AutoId:po,_ByteString:_e,_DatabaseId:hn,_DocumentKey:M,_EmptyAuthCredentialsProvider:yl,_FieldPath:le,_cast:me,_logWarn:xt,_validateIsNotUsedTogether:Eh,addDoc:wv,arrayUnion:bv,collection:ev,connectFirestoreEmulator:Ih,deleteDoc:Tv,deleteField:Sv,doc:Th,ensureFirestoreConfigured:zt,executeWrite:Rn,getDoc:yv,getDocs:vv,getFirestore:rv,increment:kv,initializeFirestore:nv,limit:fv,onSnapshot:Av,orderBy:dv,query:lv,runTransaction:Pv,serverTimestamp:Cv,setDoc:Ev,startAfter:pv,updateDoc:Iv,where:hv,writeBatch:Dv},Symbol.toStringTag,{value:"Module"}));export{wd as $,Ku as A,em as B,Jp as C,Yp as D,Bt as E,yu as F,Xe as G,Q as H,fr as I,vd as J,Ad as K,Vv as L,eo as M,Vd as N,Xn as O,Nv as P,hu as Q,cn as R,Nt as S,ae as T,yt as U,Sv as V,kv as W,Pv as X,yn as Y,at as Z,Ii as _,Tv as a,Rd as a0,Ov as a1,$f as a2,rm as a3,Us as a4,ol as a5,el as a6,co as a7,nv as a8,bu as a9,Mv as aa,pv as ab,Lv as ac,qv as ad,wv as b,ev as c,Th as d,yv as e,sm as f,vv as g,Qp as h,gg as i,Hp as j,om as k,Ev as l,Dv as m,rv as n,dv as o,Av as p,lv as q,Pm as r,Cv as s,im as t,Iv as u,fv as v,hv as w,tm as x,bv as y,Rm as z};
