import invert from 'lodash.invert';

type TextIndex = string | number;

const TILE_WIDTH = 5;
const TILE_HEIGHT = 6;

const BASIC_TEXT = '0123456789/';
const SPECIAL_TEXT: { [key: string]: number } = {};
const SPECIAL_INDEXES = invert(SPECIAL_TEXT);

export const NEWLINE = 'NEWLINE';

export function indexesToText(indexes: TextIndex[]) {
  return indexes
    .map((i) => {
      if (i === -1) {
        return ' ';
      } else if (i === NEWLINE) {
        return '\n';
      } else if (i in SPECIAL_INDEXES) {
        return `{${SPECIAL_INDEXES[i]}}`;
      } else {
        return BASIC_TEXT[i as number];
      }
    })
    .join('');
}

interface TextOptions {
  background?: number | null;
  tint?: number | null;
}

export default class Text {
  scene: Phaser.Scene;
  tilemap: Phaser.Tilemaps.Tilemap;
  tileset: Phaser.Tilemaps.Tileset;
  background?: Phaser.GameObjects.Rectangle;
  layer: Phaser.Tilemaps.TilemapLayer;
  cursor: {
    x: number;
    y: number;
  };

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    charWidth: number,
    charHeight: number,
    text: string,
    { background = null, tint = null }: TextOptions = {}
  ) {
    this.scene = scene;
    this.tilemap = scene.make.tilemap({
      tileWidth: TILE_WIDTH,
      tileHeight: TILE_HEIGHT,
      width: charWidth,
      height: charHeight,
    });
    this.tileset = this.tilemap.addTilesetImage('tilesetText')!;

    if (background !== null) {
      const width = charWidth * TILE_WIDTH;
      const height = charHeight * TILE_HEIGHT;
      this.background = scene.add.rectangle(x + width / 2, y + height / 2, width, height, background);
    }

    this.layer = this.tilemap.createBlankLayer('text', this.tileset, x, y)!;
    this.cursor = {
      x: 0,
      y: 0,
    };

    if (text) {
      this.setText(text);
    }

    if (tint) {
      this.setTint(tint);
    }
  }

  static preload(scene: Phaser.Scene) {
    scene.load.spritesheet('tilesetText', 'ui/text.png', { frameWidth: 7, frameHeight: 7 });
  }

  setPosition(x: number, y: number) {
    this.layer.setPosition(x, y);
    this.background?.setPosition(x, y);
    return this;
  }

  setDepth(depth: number) {
    this.layer.setDepth(depth);
    this.background?.setDepth(depth);
    return this;
  }

  setScrollFactor(factor: number) {
    this.layer.setScrollFactor(factor);
    this.background?.setScrollFactor(factor);
    return this;
  }

  setVisible(visible: boolean) {
    this.layer.setVisible(visible);
    this.background?.setVisible(visible);
    return this;
  }

  setSize(width: number, height: number) {
    this.layer.setSize(width, height);
    this.background?.setSize(width, height);
    return this;
  }

  setTint(tint: number) {
    this.layer.forEachTile((tile) => (tile.tint = tint));
    return this;
  }

  setCursor(x: number, y: number) {
    this.cursor.x = x;
    this.cursor.y = y;
    return this;
  }

  destroy() {
    this.tilemap.destroy();
    this.background?.destroy();
  }

  clear() {
    this.layer.fill(-1, 0, 0, this.tilemap.width, this.tilemap.height, false);
    this.cursor.x = 0;
    this.cursor.y = 0;
    return this;
  }

  parseText(text: string) {
    const indexes = [];
    for (let k = 0; k < text.length; k++) {
      const letter = text.charAt(k);
      if (letter === '{') {
        // Special character
        const bracketIndex = text.indexOf('}', k);
        if (bracketIndex === -1) {
          throw new Error(`Unmatched bracket: ${text}`);
        }

        const name = text.slice(k + 1, bracketIndex);
        const specialIndex = SPECIAL_TEXT[name];
        if (!specialIndex) {
          throw new Error(`Invalid special text tag ${name}: ${text}`);
        }

        k = bracketIndex;
        indexes.push(specialIndex);
      } else if (letter === '\n') {
        indexes.push(NEWLINE);
      } else {
        // Basic letter
        indexes.push(BASIC_TEXT.indexOf(letter));
      }
    }
    return indexes;
  }

  setText(text: string, x = 0, y = 0) {
    this.clear();
    this.appendText(text, x, y);
    return this;
  }

  appendText(text: string, x: number, y: number, indent?: boolean) {
    this.appendIndexes(this.parseText(text), x, y, indent);
    return this;
  }

  appendIndexes(indexes: TextIndex[], x: number, y: number, indent = false) {
    if (x !== undefined && y !== undefined) {
      this.cursor.x = x;
      this.cursor.y = y;
    }

    const startX = indent ? this.cursor.x : 0;
    for (const tileIndex of indexes) {
      if (tileIndex === NEWLINE) {
        this.cursor.x = startX;
        this.cursor.y++;
      } else {
        if (this.cursor.x >= this.tilemap.width) {
          this.cursor.y++;
          this.cursor.x = 0;
        }
        this.layer.putTileAt(tileIndex as number, this.cursor.x, this.cursor.y, false);
        this.cursor.x++;
      }
    }

    return this;
  }

  scroll(lines: number) {
    this.layer.copy(0, lines, this.tilemap.width, this.tilemap.height - lines, 0, 0, false);
    this.layer.fill(-1, 0, this.tilemap.height - lines, this.tilemap.width, lines, false);
    return this;
  }
}
