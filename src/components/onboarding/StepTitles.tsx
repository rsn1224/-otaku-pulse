import type React from 'react';
import { TagInputStep } from './TagInputStep';

interface StepTitlesProps {
  titles: string[];
  setTitles: (v: string[]) => void;
  titleInput: string;
  setTitleInput: (v: string) => void;
  addTag: (
    input: string,
    setter: (v: string) => void,
    list: string[],
    listSetter: (v: string[]) => void,
  ) => void;
  removeTag: (tag: string, list: string[], listSetter: (v: string[]) => void) => void;
}

export const StepTitles: React.FC<StepTitlesProps> = ({
  titles,
  setTitles,
  titleInput,
  setTitleInput,
  addTag,
  removeTag,
}) => (
  <TagInputStep
    tags={titles}
    tagSetter={setTitles}
    input={titleInput}
    inputSetter={setTitleInput}
    addTag={addTag}
    removeTag={removeTag}
    placeholder="作品名を入力..."
  />
);
