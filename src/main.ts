import './style.css';

import Phaser from 'phaser';

import BattleScene from 'gate/scenes/battle';

declare global {
  interface Window {
    game: Phaser.Game;
  }
}

window.addEventListener('load', () => {
  window.game = new Phaser.Game({
    type: Phaser.AUTO,
    height: 240,
    width: 380,
    zoom: 2,
    backgroundColor: '#000',
    parent: 'game',
    render: {
      pixelArt: true,
    },
    scene: [new BattleScene()],
  });
});
