import Phaser from 'phaser';
import { RoadScene } from './scenes/RoadScene';

new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  scale: {
    mode: Phaser.Scale.RESIZE,
    width: '100%',
    height: '100%',
  },
  backgroundColor: '#1a1621',
  scene: [RoadScene],
});
