// Journey 18: the Command Palette's default, and what the power-user setting changes.
//
// The everyday commands are in the palette on their own; the rest wait behind the power-user
// setting. The journey checks one command from each side while the setting is off, turns the
// setting on and checks again, turns it off to show the palette returns to the default, and
// leaves the setting as the suite's setup found it. The two names and the setting live in
// journeyFacts.mjs, where a unit test holds them against the manifest, so this journey cannot
// quietly disagree with the product.
import { assert } from '../lib/session.mjs';
import {
  PALETTE_EVERYDAY_COMMAND,
  PALETTE_POWER_USER_COMMAND,
  POWER_USER_SETTING
} from '../lib/journeyFacts.mjs';

const J = 'J18 palette toggle';

export async function run(ctx) {
  const { s } = ctx;

  await s.step(
    J,
    'the everyday commands are in the palette without the power-user setting',
    'an everyday command is listed and a power-user command is hidden while the setting is off',
    async () => {
      await s.setSetting(POWER_USER_SETTING, false);
      await s.page.waitForTimeout(1000);
      const everyday = await s.cmdListed(PALETTE_EVERYDAY_COMMAND);
      const power = await s.cmdListed(PALETTE_POWER_USER_COMMAND);
      assert(everyday, `${PALETTE_EVERYDAY_COMMAND} is not in the default palette`);
      assert(!power, `${PALETTE_POWER_USER_COMMAND} is in the default palette`);
      return `${PALETTE_EVERYDAY_COMMAND} is listed and ${PALETTE_POWER_USER_COMMAND} is hidden`;
    }
  );

  await s.step(
    J,
    'the power-user setting widens the palette',
    'the power-user command is listed with the setting on, and the everyday command stays',
    async () => {
      await s.setSetting(POWER_USER_SETTING, true);
      await s.page.waitForTimeout(1000);
      const everyday = await s.cmdListed(PALETTE_EVERYDAY_COMMAND);
      const power = await s.cmdListed(PALETTE_POWER_USER_COMMAND);
      assert(power, `${PALETTE_POWER_USER_COMMAND} is still hidden with the setting on`);
      assert(everyday, `${PALETTE_EVERYDAY_COMMAND} left the palette with the setting on`);
      return `${PALETTE_POWER_USER_COMMAND} is listed and ${PALETTE_EVERYDAY_COMMAND} stays`;
    }
  );

  await s.step(
    J,
    'turning the setting off takes the power-user commands back out',
    'the power-user command is hidden again and the everyday command stays',
    async () => {
      await s.setSetting(POWER_USER_SETTING, false);
      await s.page.waitForTimeout(1000);
      const everyday = await s.cmdListed(PALETTE_EVERYDAY_COMMAND);
      const power = await s.cmdListed(PALETTE_POWER_USER_COMMAND);
      assert(
        !power,
        `${PALETTE_POWER_USER_COMMAND} stayed in the palette after the setting was turned off`
      );
      assert(everyday, `${PALETTE_EVERYDAY_COMMAND} left the palette`);
      return 'the palette is back to the everyday commands';
    }
  );

  // The other journeys run the advanced commands from the palette, so the setting goes back on.
  await s.setSetting(POWER_USER_SETTING, true);
}
