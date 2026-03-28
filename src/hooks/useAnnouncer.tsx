import { useAnnouncerStore } from '../stores/useAnnouncerStore';

export function Announcer(): React.JSX.Element {
  const politeMessage = useAnnouncerStore((s) => s.politeMessage);
  const assertiveMessage = useAnnouncerStore((s) => s.assertiveMessage);

  return (
    <>
      <div role="status" aria-live="polite" aria-atomic="true" className="sr-only">
        {politeMessage}
      </div>
      <div role="alert" aria-live="assertive" aria-atomic="true" className="sr-only">
        {assertiveMessage}
      </div>
    </>
  );
}

export function useAnnounce(): {
  announce: (message: string, priority?: 'polite' | 'assertive') => void;
} {
  const announcePolite = useAnnouncerStore((s) => s.announcePolite);
  const announceAssertive = useAnnouncerStore((s) => s.announceAssertive);

  const announce = (message: string, priority: 'polite' | 'assertive' = 'polite'): void => {
    if (priority === 'assertive') {
      announceAssertive(message);
    } else {
      announcePolite(message);
    }
  };

  return { announce };
}
