import test from "node:test";
import assert from "node:assert/strict";
import { localeOptions, translate, localeDirection } from "../src/i18n.js";

test("locale foundation includes Persian, English and multiple global languages", () => {
  const codes = localeOptions.map(item => item.code);
  for (const code of ["fa", "en", "de", "ar", "tr", "es", "fr", "ru", "zh", "hi", "ur", "pt"]) assert.ok(codes.includes(code));
});

test("locale dictionaries expose core interface labels with fallback", () => {
  assert.equal(translate("send", "en"), "Send ↑");
  assert.equal(translate("send", "fa"), "ارسال ↑");
  assert.equal(translate("unknown-key", "en"), "unknown-key");
});

test("right-to-left and left-to-right directions are explicit", () => {
  assert.equal(localeDirection("fa"), "rtl");
  assert.equal(localeDirection("ar"), "rtl");
  assert.equal(localeDirection("en"), "ltr");
  assert.equal(localeDirection("de"), "ltr");
});


test("visible chat controls are translated in every supported locale", () => {
  for (const locale of localeOptions.map(item => item.code)) {
    for (const key of ["idea","ideaDesc","learning","learningDesc","content","contentDesc","planning","planningDesc","you","assistant","copy","copyDone","copyFailed","thinking","suggestionsLabel","footer","promptIdea","promptLearning","promptContent","promptPlanning"]) assert.notEqual(translate(key, locale), key, locale + ":" + key);
  }
});


test("API errors and accessibility labels are localized in every supported locale", () => {
  const keys = ["errorAiNotConfigured","errorBodyTooLarge","errorMessageTooLong","errorUpstreamTimeout","errorUpstreamUnavailable","errorGeneric","chatMessagesLabel","messageInputLabel","logoAlt"];
  for (const locale of localeOptions.map(item => item.code)) {
    for (const key of keys) assert.notEqual(translate(key, locale), key, locale + ":" + key);
  }
});


test("account fallback strings exist for Persian and English", () => {
 for (const locale of ["fa","en"]) for (const key of ["accountSetupHint","createAccount","resetAccepted","verificationAccepted","registrationAccepted"]) assert.notEqual(translate(key,locale),key);
});


test("account interface strings are genuinely localized in every supported locale", () => {
 const keys=["quotaUsed","quotaReset","accountPanelLabel","accountClose","accountChecking","accountNotReady","accountSignedIn","quotaToday","quotaNotEnabled","logout","loggedOut","logoutFailed","accountSignInPrompt","login","register","email","password","forgotPassword","resendVerification","passwordMinimum","enterEmail","sendingReset","resetFailed","sendingVerification","verificationFailed","sendingRequest","loginFailed","loginSuccess","accountCheckFailed","accountSetupHint","createAccount","resetAccepted","verificationAccepted","registrationAccepted"];
 for (const locale of localeOptions.map(item => item.code)) {
   for (const key of keys) {
     const value=translate(key,locale);
     assert.notEqual(value,key,locale+":"+key);
     if (locale !== "fa" && locale !== "en") assert.notEqual(value,translate(key,"en"),locale+" fell back to English for "+key);
   }
 }
});


test("workflow toolbox labels and prompts are translated in every supported locale", () => {
 const keys=["toolboxTitle","toolboxDesc","toolResearch","toolResearchPrompt","toolBusiness","toolBusinessPrompt","toolCoding","toolCodingPrompt","toolTranslate","toolTranslatePrompt","toolImage","toolImagePrompt","toolStudy","toolStudyPrompt"];
 for (const locale of localeOptions.map(item=>item.code)) {
   for (const key of keys) {
     const value=translate(key,locale);
     assert.notEqual(value,key,locale+":"+key);
     if (locale!=="fa" && locale!=="en") assert.notEqual(value,translate(key,"en"),locale+" fell back to English for "+key);
   }
 }
});


test("workspace interface is translated in every supported locale", () => {
 const keys=["workspace","workspaceTitle","workspaceSubtitle","workspaceHistory","workspaceProjects","workspaceSaveChat","workspaceNoHistory","workspaceNoProjects","workspaceProjectName","workspaceProjectPrompt","workspaceAddProject","workspaceLocalNotice","workspaceQuotaTitle","workspaceQuotaPending","workspaceOpenChat","workspaceUsePrompt","workspaceDelete","workspaceClose","workspaceNeedMessages","workspaceSaved","workspaceDeleted","workspaceProjectAdded","workspaceNameRequired","workspaceUntitled"];
 for (const locale of localeOptions.map(item=>item.code)) {
   for (const key of keys) {
     const value=translate(key,locale);
     assert.notEqual(value,key,locale+":"+key);
     if(locale!=="fa"&&locale!=="en") assert.notEqual(value,translate(key,"en"),locale+" fell back to English for "+key);
   }
 }
});
