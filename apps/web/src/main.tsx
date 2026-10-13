import { createRoot } from 'react-dom/client';
import { readConfig } from './config';
import {App} from './App';
readConfig(import.meta.env);
createRoot(document.getElementById('root')!).render(<App/>);
