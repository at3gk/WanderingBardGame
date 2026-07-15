import Phaser from 'phaser';

export class RoadScene extends Phaser.Scene {
  constructor() {
    super('RoadScene');
  }

  create(): void {
    this.cameras.main.setBackgroundColor('#1a1621');
  }
}
