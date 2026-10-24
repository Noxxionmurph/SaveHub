// Pokémon Yellow only: the starter Pikachu's friendship and mood, how it will react when you talk to it, and whether
// the game still counts it as yours.

import { BULBASAUR_FRIENDSHIP, MOOD_NEUTRAL, friendshipLabel, moodLabel, pikachuReactionInfo } from '../../../core/gen1/data.ts';
import { PIKACHU_INTERNAL, type Gen1Mon, type Gen1Save } from '../../../core/gen1/save.ts';
import { clear, h, numberInput } from '../../dom.ts';
import { pikachuPic, pokemonIcon, setPikachuPic } from '../../sprites.ts';

export interface PikachuCardHost {
  markDirty(): void;
  /** Register a redraw that runs whenever the party list below the card changes. */
  onRefresh(fn: () => void): void;
  monLabel(m: Gen1Mon): string;
}

export function pikachuCard(s: Gen1Save, host: PikachuCardHost): Node {
  // ---- the preview: what Pikachu does when you talk to it, at the friendship and mood set below ----
  const first = pikachuReactionInfo(s.pikachuFriendship, s.pikachuMood);
  const pic = pikachuPic(first.row, `Pikachu ${first.text}`, true);
  const says = h('p', { class: 'pika-says', 'aria-live': 'polite' });
  const context = h('p', { class: 'pika-context' });
  const preview = h('div', { class: 'pika-preview', role: 'group', 'aria-label': 'How Pikachu reacts when you talk to it' },
    h('div', { class: 'pika-screen' }, pic),
    h('div', { class: 'pika-text' }, h('span', { class: 'pika-kicker' }, 'Talk to it'), says, context));

  function paintPreview(): void {
    const f = s.pikachuFriendship, m = s.pikachuMood;
    const now = pikachuReactionInfo(f, m);
    setPikachuPic(pic, now.row, `Pikachu ${now.text}`);
    says.textContent = `Pikachu ${now.text}.`;
    context.textContent = `Friendship ${f}, mood ${moodLabel(m).toLowerCase()}`;
  }

  /** A 0 to 255 value shown as a big number and a label, with a slider and a number box that stay in step. */
  function dial(title: string, get: () => number, put: (v: number) => void, describe: (v: number) => string, extra = '') {
    const label = h('span', { class: 'friend-label' });
    const value = h('output', { class: 'friend-value', 'aria-label': title });
    const slider = h('input', { type: 'range', min: 0, max: 255, step: 1, value: String(get()), 'aria-label': title });
    const number = numberInput(get(), 0, 255, (v) => set(v), { 'aria-label': `${title} number` });
    const paint = () => { value.textContent = String(get()); label.textContent = describe(get()); };
    function set(v: number): void {
      put(v);
      slider.value = String(v);
      number.value = String(v);
      paint();
      paintPreview();
      host.markDirty();
    }
    slider.addEventListener('input', () => set(Number(slider.value)));
    paint();
    return {
      set,
      lcd: h('div', { class: `lcd friend ${extra}`.trim() }, h('span', { class: 'friend-head' }, title), value, label),
      controls: h('div', { class: 'friend-controls' }, slider, number),
    };
  }

  const friend = dial('Friendship', () => s.pikachuFriendship, (v) => { s.pikachuFriendship = v; }, friendshipLabel);
  const fade = h('p', { class: 'muted' });
  const mood = dial('Mood', () => s.pikachuMood, (v) => { s.pikachuMood = v; paintFade(); }, moodLabel, 'second');
  function paintFade(): void {
    const steps = Math.abs(s.pikachuMood - MOOD_NEUTRAL);
    fade.textContent = steps === 0
      ? 'Neutral is where the mood settles. Walking moves it 1 step back toward neutral, so a changed mood fades as you walk.'
      : `Walking moves the mood 1 step back toward neutral, so this fades after about ${steps} step${steps === 1 ? '' : 's'}. Set it just before you want to see it.`;
  }

  // ---- whether the game still counts it as your starter ----
  const status = h('div', { class: 'starter-status', 'aria-live': 'polite' });
  const drawStatus = () => {
    clear(status);
    const at = s.party.findIndex((m) => s.isStarterPikachu(m));
    if (at >= 0) {
      status.append(h('p', {}, h('strong', {}, 'Starter Pikachu: '), `${host.monLabel(s.party[at])} (party ${at + 1}). It follows you while it's in your party and hasn't fainted.`));
      return;
    }
    const other = s.party.findIndex((m) => m.species === PIKACHU_INTERNAL);
    if (other < 0) {
      status.append(h('p', {}, h('strong', {}, 'No Pikachu in your party. '),
        'The game only follows a Pikachu whose original trainer is your name and Trainer ID. Add a Pikachu to your party and a button to make it your starter will appear here.'));
      return;
    }
    status.append(
      h('p', {}, h('strong', {}, 'Not your starter. '),
        `${host.monLabel(s.party[other])}'s original trainer doesn't match your name and Trainer ID, so it won't follow you. The button copies your name and ID onto it.`),
      h('button', { onclick: () => { s.makeStarter(s.party[other]); host.markDirty(); drawStatus(); } }, `Make ${host.monLabel(s.party[other])} my starter`));
  };
  host.onRefresh(drawStatus);

  paintFade();
  paintPreview();
  drawStatus();

  return h('section', { class: 'card pikachu-card' },
    h('div', { class: 'card-title' }, pokemonIcon(25, 'card-icon'), h('h3', {}, 'Pikachu')),
    h('p', { class: 'card-note' },
      'Your starter has two settings: friendship, how much it likes you, and mood, how it feels right now. Together they decide how it reacts when you talk to it. Both run from 0 to 255.'),
    preview,
    friend.lcd, friend.controls,
    h('div', { class: 'button-row' }, h('button', { onclick: () => friend.set(255) }, 'Max friendship')),
    h('p', { class: 'muted' },
      `The words under the number are what the granny in Celadon Mansion says about it. Melanie in Cerulean City only gives you her Bulbasaur if friendship is above ${BULBASAUR_FRIENDSHIP - 1}.`),
    mood.lcd, mood.controls,
    h('div', { class: 'button-row' },
      h('button', { onclick: () => mood.set(0) }, 'Upset'),
      h('button', { onclick: () => mood.set(MOOD_NEUTRAL) }, 'Neutral'),
      h('button', { onclick: () => mood.set(255) }, 'Cheerful')),
    fade,
    status);
}
