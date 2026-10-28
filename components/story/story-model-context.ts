import { createContext } from 'react';
import type { StoryModel } from './story-model';

export const StoryModelContext = createContext<StoryModel | null>(null);
