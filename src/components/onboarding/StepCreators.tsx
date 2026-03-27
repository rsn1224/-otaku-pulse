import type React from 'react';
import { TagInputStep } from './TagInputStep';

interface StepCreatorsProps {
  creators: string[];
  setCreators: (v: string[]) => void;
  creatorInput: string;
  setCreatorInput: (v: string) => void;
  addTag: (
    input: string,
    setter: (v: string) => void,
    list: string[],
    listSetter: (v: string[]) => void,
  ) => void;
  removeTag: (tag: string, list: string[], listSetter: (v: string[]) => void) => void;
}

export const StepCreators: React.FC<StepCreatorsProps> = ({
  creators,
  setCreators,
  creatorInput,
  setCreatorInput,
  addTag,
  removeTag,
}) => (
  <TagInputStep
    tags={creators}
    tagSetter={setCreators}
    input={creatorInput}
    inputSetter={setCreatorInput}
    addTag={addTag}
    removeTag={removeTag}
    placeholder="クリエイター名を入力..."
  />
);
