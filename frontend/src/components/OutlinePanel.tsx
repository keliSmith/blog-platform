import { useTranslation } from '../i18n';

export interface OutlineItem {
  level: number;
  text: string;
}

interface OutlinePanelProps {
  items: OutlineItem[];
  /** 当前高亮章节索引（滚动驱动）。-1 表示不高亮。 */
  activeIndex?: number;
  onJump: (index: number) => void;
  /** 空大纲时的占位提示（编辑页用：尚未添加标题也展示大纲面板）。不传则空大纲返回 null。 */
  emptyHint?: string;
}

/**
 * 文章大纲（目录）面板——详情、编辑、新增三页共用，保持与语雀一致：
 * - 位于页面右侧，吸顶；层级缩进（h1/h2/h3...）；
 * - 当前阅读章节高亮（左侧色条 + 主题色文字 + 浅底色）；
 * - 暗色模式自适应（跟随 html.dark）。
 */
export default function OutlinePanel({
  items,
  activeIndex = -1,
  onJump,
  emptyHint,
}: OutlinePanelProps) {
  const { t } = useTranslation();
  if (items.length === 0) {
    if (!emptyHint) return null;
    return (
      <nav className="outline-panel" aria-label={t('outline')}>
        <div className="outline-panel__title">{t('outline')}</div>
        <div className="outline-empty">{emptyHint}</div>
      </nav>
    );
  }

  return (
    <nav className="outline-panel" aria-label={t('outline')}>
      <div className="outline-panel__title">{t('outline')}</div>
      <ul className="outline-list">
        {items.map((h, i) => (
          <li key={`${h.level}-${i}`}>
            <button
              type="button"
              className={
                'outline-item outline-item--l' +
                h.level +
                (i === activeIndex ? ' is-active' : '')
              }
              onClick={() => onJump(i)}
              title={h.text}
            >
              {h.text}
            </button>
          </li>
        ))}
      </ul>
    </nav>
  );
}
