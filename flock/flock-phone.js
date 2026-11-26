'use strict';
(function () {
  const T = window.FLOCK_TUNING = window.FLOCK_TUNING || {};
  const S = T.states = T.states || {};
  S.listening = Object.assign({}, S.listening, { drift: 1 });
})();
