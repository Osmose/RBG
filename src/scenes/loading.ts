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
      key: 'loadingWait',
      frameRate: 10,
      frames: this.anims.generateFrameNumbers('loadingCount', { frames: [0, 1, 2, 1] }),
      repeat: -1,
    });
    this.anims.create({
      key: 'loadingToStart',
      frameRate: 10,
      frames: this.anims.generateFrameNumbers('loadingCount', { frames: [3, 4, 5, 6] }),
      repeat: 0,
    });
    this.anims.create({
      key: 'loadingStartToEmpty',
      frameRate: 10,
      frames: this.anims.generateFrameNumbers('loadingCount', { frames: [6, 5, 4] }),
      repeat: 0,
    });
    this.anims.create({
      key: 'loadingCountdown',
      frameRate: 10,
      frames: this.anims.generateFrameNumbers('loadingCount', {
        frames: [8, 9, 10, 10, 11, 12, 13, 13, 14, 15, 16, 16, 17, 18, 19, 20, 21, 22, 23],
      }),
      repeat: 0,
    });

    this.loadingCount = this.add
      .sprite(this.cameras.main.centerX, this.cameras.main.centerY, 'loadingCount')
      .play('loadingWait');

    const battleScene = this.scene.get('battle') as BaseScene;
    asyncLoad(this, () => {
      battleScene.loadResources(this);
    }).then(async () => {
      await asyncAnimation(this.loadingCount, 'loadingToStart');
      this.loadingCount.on('pointerdown', () => {
        this.loadingCount.setFrame(7);
      });
      this.loadingCount.on('pointerup', async () => {
        await asyncAnimation(this.loadingCount, 'loadingStartToEmpty');
        this.scene.run('battle');
      });
      this.loadingCount.setInteractive();
    });
  }

  async countdown() {
    await asyncAnimation(this.loadingCount, 'loadingCountdown');
    this.scene.stop();
  }

  update() {}
}
