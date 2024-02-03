import './style.css';

import Phaser from 'phaser';

import BattleScene from 'gate/scenes/battle';
import LoadingScene from 'gate/scenes/loading';
import { BASE_HEIGHT, BASE_WIDTH } from 'gate/constants';

declare global {
  interface Window {
    game: Phaser.Game;
  }
}

window.addEventListener('load', () => {
  window.game = new Phaser.Game({
    type: Phaser.AUTO,
    height: BASE_HEIGHT,
    width: BASE_WIDTH,
    scale: {
      mode: Phaser.Scale.FIT,
    },
    backgroundColor: '#000',
    render: {
      pixelArt: true,
    },
    scene: [new LoadingScene(), new BattleScene()],
  });
});
