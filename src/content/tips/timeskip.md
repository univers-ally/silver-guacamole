---
title: Timeskipping (speeding up daily claims)
order: 40
---

Daily-claim promos might go by your phone's clock. We can exploit this by changing the phone's time zone to a place where it's already tomorrow and thus Temu thinks a day has passed. You can burn through every day of most daily-claims/calendars in one day, so never ever pay extra to unlock early unless you can't timeskip.

For it to work correctly, whatever time zone you switch to needs to have since passed midnight since your last claim, otherwise Temu will still think that it's the same day.

The calculator below can be used to tell you which zone to switch to, and when, once you claim something.

1. Tap the button after claiming
2. Set your phone's time zone to the city it shows, open Temu, claim again.
3. Repeat. It's one new claim/zone per hour.

<div class="tzcalc">
  <button type="button" id="tz-claim">I just claimed</button>
  <div id="tz-out" role="status"></div>
</div>

Works on `GET100` and may work on other offers. Be careful if you have other daily-claim promos going at the same time as this may or may not affect them.
