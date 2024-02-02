import BaseScene from 'gate/scenes/base';
import { asyncAnimation, asyncLoad } from 'gate/util';

export default class LoadingScene extends BaseScene {
  loadingCount!: Phaser.GameObjects.Sprite;

  constructor() {
    super({
      key: 'loading',
    });
  }

  preload() {
    this.load.spritesheet('loadingCount', 'ui/loading_count.png', { frameWidth: 20, frameHeight: 20 });
  }

  create() {
    this.anims.create({
      key: 'loadingCountdown',
      frameRate: 10,
      delay: 150,
      frames: this.anims.generateFrameNumbers('loadingCount', { start: 1, end: 21 }),
      repeat: 0,
    });

    this.loadingCount = this.add.sprite(this.cameras.main.centerX, this.cameras.main.centerY, 'loadingCount', 0);

    const battleScene = this.scene.get('battle') as BaseScene;
    asyncLoad(this, () => {
      battleScene.loadResources(this);
    }).then(async () => {
      this.scene.run('battle');
    });
  }

  async countdown() {
    await asyncAnimation(this.loadingCount, 'loadingCountdown');
    this.scene.stop();
  }

  update() {}
}
