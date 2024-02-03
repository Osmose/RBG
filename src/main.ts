import './style.css';

import Phaser from 'phaser';

import BattleScene from 'gate/scenes/battle';
import LoadingScene from 'gate/scenes/loading';

declare global {
  interface Window {
    game: Phaser.Game;
  }
}

window.addEventListener('load', () => {
  window.game = new Phaser.Game({
    type: Phaser.AUTO,
    height: 202,
    width: 350,
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
