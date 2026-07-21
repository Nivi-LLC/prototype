/* Lightweight client-side gate for stakeholder demo. Not real security. */
(function () {
  var KEY = "nivi_passports_unlocked";
  var PASS = "9999";

  function unlock() {
    try {
      sessionStorage.setItem(KEY, "1");
    } catch (e) {}
  }

  function isUnlocked() {
    try {
      return sessionStorage.getItem(KEY) === "1";
    } catch (e) {
      return false;
    }
  }

  function showGate() {
    document.documentElement.style.visibility = "hidden";

    function paint() {
      document.documentElement.style.visibility = "visible";
      document.body.innerHTML =
        '<div class="gate">' +
        '<form class="gate-card" id="nivi-gate-form" autocomplete="off">' +
        '<div class="gate-brand">NIVI Passports</div>' +
        '<p class="gate-sub">Prototype access</p>' +
        '<label class="gate-label" for="nivi-gate-pass">Password</label>' +
        '<input class="gate-input" id="nivi-gate-pass" type="password" inputmode="numeric" maxlength="16" placeholder="Enter password" autofocus />' +
        '<p class="gate-error" id="nivi-gate-error" hidden>Incorrect password</p>' +
        '<button class="gate-btn" type="submit">Open passport</button>' +
        '<p class="gate-note">Stakeholder demo · synthetic data only</p>' +
        "</form></div>";

      var form = document.getElementById("nivi-gate-form");
      var input = document.getElementById("nivi-gate-pass");
      var err = document.getElementById("nivi-gate-error");
      form.addEventListener("submit", function (e) {
        e.preventDefault();
        if ((input.value || "").trim() === PASS) {
          unlock();
          location.reload();
          return;
        }
        err.hidden = false;
        input.value = "";
        input.focus();
      });
    }

    if (document.body) paint();
    else document.addEventListener("DOMContentLoaded", paint);
  }

  if (!isUnlocked()) {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", showGate);
    } else {
      showGate();
    }
  }
})();
