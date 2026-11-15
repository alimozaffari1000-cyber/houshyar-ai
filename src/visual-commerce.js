const COPY = {
  fa: {open:"تجربه مجازی",title:"آزمایش مجازی لباس و چیدمان خانه",desc:"عکس خودت یا فضای خانه را انتخاب کن و تصویر محصول را برای آماده‌سازی آزمایش انتخاب کن.",apparel:"پرو لباس",room:"چیدمان خانه",person:"عکس تمام‌قد خودت",space:"عکس اتاق یا فضای خانه",product:"عکس محصول",choose:"انتخاب تصویر",remove:"حذف تصویر",privacy:"تصاویر فقط در همین مرورگر پیش‌نمایش داده می‌شوند؛ در این نسخه هیچ تصویری به سرور ارسال یا ذخیره نمی‌شود.",ready:"پیش‌نمایش محلی آماده است. برای تولید نتیجه واقعی باید سرویس پردازش تصویر و فضای ذخیره‌سازی امن متصل شود.",provider:"تولید تصویر هوش مصنوعی هنوز فعال نشده است.",close:"بستن",fileError:"فقط تصویر JPG، PNG یا WebP تا حجم ۸ مگابایت مجاز است.",need:"برای ادامه، تصویر محیط/شخص و تصویر محصول را انتخاب کن."},
  en: {open:"Virtual try-on",title:"Virtual try-on & room styling",desc:"Choose a photo of yourself or your room, then add the product image to prepare a try-on.",apparel:"Try on clothing",room:"Style a room",person:"Full-body photo",space:"Room photo",product:"Product photo",choose:"Choose image",remove:"Remove image",privacy:"Images are previewed only in this browser. This version does not upload or store any images.",ready:"Local preview is ready. A real result requires a connected image-processing provider and secure storage.",provider:"AI image generation is not enabled yet.",close:"Close",fileError:"Only JPG, PNG or WebP images up to 8 MB are allowed.",need:"Choose both a person/room photo and a product photo to continue."}
};
const escapeHTML = value => String(value).replace(/[&<>"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const MAX_BYTES = 8 * 1024 * 1024;
const TYPES = new Set(["image/jpeg","image/png","image/webp"]);

export function initVisualCommerce(root,{locale="fa"}={}) {
  const trigger=root.querySelector("[data-open-visual-commerce]");
  if(!trigger) return;
  const c=COPY[locale]||COPY.en;
  const rtl=["fa","ar","ur"].includes(locale);
  const overlay=document.createElement("section");
  overlay.className="visual-commerce-overlay";
  overlay.hidden=true;
  overlay.dir=rtl?"rtl":"ltr";
  overlay.innerHTML=`
    <div class="visual-commerce-dialog" role="dialog" aria-modal="true" aria-labelledby="visual-commerce-title">
      <header class="visual-commerce-head"><div><span>HOUSHYAR VISUAL LAB</span><h2 id="visual-commerce-title">${c.title}</h2><p>${c.desc}</p></div><button type="button" data-visual-close aria-label="${c.close}">×</button></header>
      <div class="visual-commerce-tabs"><button type="button" data-visual-mode="apparel" class="active">${c.apparel}</button><button type="button" data-visual-mode="room">${c.room}</button></div>
      <div class="visual-commerce-upload-grid">
        <label class="visual-upload-card"><strong data-scene-label>${c.person}</strong><span>${c.choose}</span><input type="file" accept="image/jpeg,image/png,image/webp" data-visual-file="scene"><img data-visual-preview="scene" alt="" hidden><small data-visual-remove="scene" hidden>${c.remove}</small></label>
        <label class="visual-upload-card"><strong>${c.product}</strong><span>${c.choose}</span><input type="file" accept="image/jpeg,image/png,image/webp" data-visual-file="product"><img data-visual-preview="product" alt="" hidden><small data-visual-remove="product" hidden>${c.remove}</small></label>
      </div>
      <p class="visual-commerce-status" role="status" aria-live="polite">${c.need}</p>
      <button type="button" class="visual-commerce-generate" disabled>${c.provider}</button>
      <p class="visual-commerce-privacy">${c.privacy}</p>
    </div>`;
  root.append(overlay);
  const urls={scene:null,product:null};
  let mode="apparel";
  const sceneLabel=overlay.querySelector("[data-scene-label]");
  const status=overlay.querySelector(".visual-commerce-status");
  const release=key=>{if(urls[key])URL.revokeObjectURL(urls[key]);urls[key]=null;overlay.querySelector('[data-visual-preview="'+key+'"]').hidden=true;overlay.querySelector('[data-visual-preview="'+key+'"]').removeAttribute("src");overlay.querySelector('[data-visual-remove="'+key+'"]').hidden=true;overlay.querySelector('[data-visual-file="'+key+'"]').value="";};
  const close=()=>{overlay.hidden=true;for(const key of Object.keys(urls))release(key);trigger.focus();};
  trigger.addEventListener("click",()=>{overlay.hidden=false;overlay.querySelector("[data-visual-mode]").focus();});
  overlay.querySelector("[data-visual-close]").addEventListener("click",close);
  overlay.addEventListener("click",event=>{if(event.target===overlay)close();});
  overlay.addEventListener("keydown",event=>{if(event.key==="Escape")close();});
  overlay.querySelectorAll("[data-visual-mode]").forEach(button=>button.addEventListener("click",()=>{
    mode=button.dataset.visualMode;
    overlay.querySelectorAll("[data-visual-mode]").forEach(item=>item.classList.toggle("active",item===button));
    sceneLabel.textContent=mode==="apparel"?c.person:c.space;
    release("scene");
    status.textContent=c.need;
  }));
  for(const key of Object.keys(urls)){
    const input=overlay.querySelector('[data-visual-file="'+key+'"]');
    input.addEventListener("change",()=>{
      release(key);
      const file=input.files?.[0];
      if(!file)return;
      if(!TYPES.has(file.type)||file.size>MAX_BYTES){status.textContent=c.fileError;input.value="";return;}
      urls[key]=URL.createObjectURL(file);
      const preview=overlay.querySelector('[data-visual-preview="'+key+'"]');
      preview.src=urls[key];preview.hidden=false;
      overlay.querySelector('[data-visual-remove="'+key+'"]').hidden=false;
      status.textContent=c.ready;
    });
    overlay.querySelector('[data-visual-remove="'+key+'"]').addEventListener("click",()=>{release(key);status.textContent=c.need;});
  }
}
