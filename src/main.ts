import { App } from './three/App';
import { SmokeStage } from './three/smoke';

const host = document.getElementById('game');
if (!host) throw new Error('no #game host element');

const app = new App(host);
const stage = new SmokeStage(app);
app.setStage(stage);
app.start();

(window as unknown as { bard: unknown }).bard = { app, stage };
