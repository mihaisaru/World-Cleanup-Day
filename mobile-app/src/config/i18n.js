import i18n from 'i18next';
import Expo from 'expo';
import {handleSentryError} from '../shared/helpers';

const languageDetector = {
  type: 'languageDetector',
  async: true, // flags below detection to be async
  detect: (callback) => {
    return Expo.Util.getCurrentLocaleAsync().then((lang) => {
      try {
        if (lang.indexOf('_')) {
          callback(lang.split('_')[0]);
        } else {
          callback(lang);
        }
      } catch (ex) {
        handleSentryError(ex)
        callback('en');
      }
    });
  },
  init: () => {},
  cacheUserLanguage: () => {},
};

i18n.use(languageDetector).init({
  fallbackLng: 'en',
  // have a common namespace used around the full app
  ns: ['general'],
  defaultNS: 'general',

  debug: false,

  // cache: {
  //   enabled: true
  // },

  interpolation: {
    // not needed for react as it does escape per default to prevent xss!
    escapeValue: false,
  },
});
i18n.addResources('en', 'general', require('../trans/en.json'));
i18n.addResources('ro', 'general', require('../trans/ro.json'));

export default i18n;
