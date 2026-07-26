import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useState,
} from 'react';
import type { SlashItem } from './slashCommand';
import { useTranslation } from '../../i18n';

export interface SlashCommandListRef {
  onKeyDown: (props: { event: KeyboardEvent }) => boolean;
}

interface SlashCommandListProps {
  items: SlashItem[];
  command: (item: SlashItem) => void;
}

const SlashCommandList = forwardRef<SlashCommandListRef, SlashCommandListProps>(
  ({ items, command }, ref) => {
    const { t } = useTranslation();
    const [selectedIndex, setSelectedIndex] = useState(0);

    useEffect(() => setSelectedIndex(0), [items]);

    const selectItem = (index: number) => {
      const item = items[index];
      if (item) command(item);
    };

    useImperativeHandle(ref, () => ({
      onKeyDown: ({ event }) => {
        if (items.length === 0) return false;
        if (event.key === 'ArrowUp') {
          setSelectedIndex((prev) => (prev + items.length - 1) % items.length);
          return true;
        }
        if (event.key === 'ArrowDown') {
          setSelectedIndex((prev) => (prev + 1) % items.length);
          return true;
        }
        if (event.key === 'Enter') {
          selectItem(selectedIndex);
          return true;
        }
        return false;
      },
    }));

    if (items.length === 0) {
      return (
        <div className="slash-menu">
          <div className="slash-menu__empty">{t('slashEmpty')}</div>
        </div>
      );
    }

    return (
      <div className="slash-menu">
        {items.map((item, index) => {
          const Icon = item.icon;
          const title = t(item.titleKey);
          const desc = t(item.descriptionKey);
          return (
            <button
              type="button"
              key={item.titleKey}
              className={
                'slash-menu__item' + (index === selectedIndex ? ' is-selected' : '')
              }
              onMouseEnter={() => setSelectedIndex(index)}
              onMouseDown={(e) => {
                // 阻止默认，避免编辑器在点击时失去焦点 / 触发 blur
                e.preventDefault();
                selectItem(index);
              }}
            >
              <span className="slash-menu__icon">
                {Icon ? <Icon /> : null}
              </span>
              <span className="slash-menu__text">
                <span className="slash-menu__title">{title}</span>
                <span className="slash-menu__desc">{desc}</span>
              </span>
            </button>
          );
        })}
      </div>
    );
  },
);

SlashCommandList.displayName = 'SlashCommandList';

export default SlashCommandList;
