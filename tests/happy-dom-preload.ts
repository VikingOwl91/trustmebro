import { afterAll } from 'bun:test';
import { GlobalRegistrator } from '@happy-dom/global-registrator';

GlobalRegistrator.register({ url: 'https://trustmebro.test/', width: 1280, height: 900 });
afterAll(async () => GlobalRegistrator.unregister());
