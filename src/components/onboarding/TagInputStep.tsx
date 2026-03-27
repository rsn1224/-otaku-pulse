import type React from 'react';

interface TagInputStepProps {
  tags: string[];
  tagSetter: (v: string[]) => void;
  input: string;
  inputSetter: (v: string) => void;
  addTag: (
    input: string,
    setter: (v: string) => void,
    list: string[],
    listSetter: (v: string[]) => void,
  ) => void;
  removeTag: (tag: string, list: string[], listSetter: (v: string[]) => void) => void;
  placeholder: string;
}

export const TagInputStep: React.FC<TagInputStepProps> = ({
  tags,
  tagSetter,
  input,
  inputSetter,
  addTag,
  removeTag,
  placeholder,
}) => (
  <div>
    <div className="flex flex-wrap gap-2 mb-3 min-h-[2rem]">
      {tags.map((tag) => (
        <span key={tag} className="tag-chip">
          {tag}
          <button
            type="button"
            className="tag-chip-remove"
            onClick={() => removeTag(tag, tags, tagSetter)}
          >
            ✕
          </button>
        </span>
      ))}
    </div>
    <div className="flex gap-2">
      <input
        type="text"
        value={input}
        onChange={(e) => inputSetter(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            addTag(input, inputSetter, tags, tagSetter);
          }
        }}
        placeholder={placeholder}
        maxLength={100}
        className="flex-1 px-3 py-2 rounded-lg text-sm bg-[var(--bg-primary)] border border-[var(--border)] text-[var(--text-primary)]"
      />
      <button
        type="button"
        onClick={() => addTag(input, inputSetter, tags, tagSetter)}
        className="card-action-btn primary"
      >
        追加
      </button>
    </div>
  </div>
);
