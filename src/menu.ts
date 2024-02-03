import BaseScene from 'gate/scenes/base';
import { Direction } from 'gate/util';
import Phaser from 'phaser';

interface BaseMenuItem {
  key: string;
  isCancel?: boolean;
}

export type MenuItem = BaseMenuItem & { [key in Direction]: string };

export default class Menu extends Phaser.Events.EventEmitter {
  scene: BaseScene;
  menuItems: { [key: string]: MenuItem };
  cursor: string | null;
  inputPaused: boolean;

  constructor(scene: BaseScene, menuItems: { [key: string]: MenuItem }) {
    super();
    this.scene = scene;
    this.menuItems = {};
    this.cursor = null;
    this.inputPaused = false;
    if (menuItems) {
      this.setMenuItems(menuItems);
    }
  }

  setMenuItems(menuItems: { [key: string]: MenuItem }, resetCursor = true) {
    this.menuItems = menuItems;

    if (resetCursor) {
      this.moveCursorTo(Object.keys(menuItems)[0]);
    }
  }

  currentItem() {
    return this.cursor ? this.menuItems[this.cursor] : null;
  }

  moveCursorTo(key: string) {
    const oldCursor = this.cursor;
    this.cursor = key;
    this.emit('focus', this.cursor, this.currentItem(), oldCursor, this);
  }

  moveCursorInDirection(direction: Direction) {
    const currentItem = this.currentItem();
    if (currentItem?.[direction]) {
      this.moveCursorTo(currentItem[direction]);
    }
  }

  select(key?: string) {
    if (key && this.cursor !== key) {
      this.moveCursorTo(key);
    }
    this.emit('select', this.cursor, this.currentItem());
  }

  pauseInput() {
    this.inputPaused = true;
    return this;
  }

  resumeInput() {
    this.inputPaused = false;
    return this;
  }

  update() {
    if (this.inputPaused || Object.values(this.menuItems).length === 0) {
      return;
    }

    if (Phaser.Input.Keyboard.JustDown(this.scene.keys.space)) {
      if (this.currentItem()?.isCancel) {
        this.emit('cancel', this.cursor);
      } else {
        this.select();
      }
      // } else if (Phaser.Input.Keyboard.JustDown(this.scene.keys.F)) {
      // this.emit('cancel', this.cursor);
    } else if (Phaser.Input.Keyboard.JustDown(this.scene.keys.up)) {
      this.moveCursorInDirection(Phaser.UP);
    } else if (Phaser.Input.Keyboard.JustDown(this.scene.keys.down)) {
      this.moveCursorInDirection(Phaser.DOWN);
    } else if (Phaser.Input.Keyboard.JustDown(this.scene.keys.left)) {
      this.moveCursorInDirection(Phaser.LEFT);
    } else if (Phaser.Input.Keyboard.JustDown(this.scene.keys.right)) {
      this.moveCursorInDirection(Phaser.RIGHT);
    }
  }
}

export function verticalMenuItems(itemList: MenuItem[]) {
  return itemList.reduce((acc, menuItem, index) => {
    menuItem[Phaser.UP] = index === 0 ? itemList[itemList.length - 1].key : itemList[index - 1].key;
    menuItem[Phaser.DOWN] = index === itemList.length - 1 ? itemList[0].key : itemList[index + 1].key;
    acc[menuItem.key] = menuItem;
    return acc;
  }, {} as { [key: string]: MenuItem });
}

export function horizontalMenuItems(itemList: MenuItem[]) {
  return itemList.reduce((acc, menuItem, index) => {
    menuItem[Phaser.LEFT] = index === 0 ? itemList[itemList.length - 1].key : itemList[index - 1].key;
    menuItem[Phaser.RIGHT] = index === itemList.length - 1 ? itemList[0].key : itemList[index + 1].key;
    acc[menuItem.key] = menuItem;
    return acc;
  }, {} as { [key: string]: MenuItem });
}
