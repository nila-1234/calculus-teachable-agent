import { GitHubLogoIcon } from "@radix-ui/react-icons";

export default function AppFooter() {
  return (
    <footer className="border-t border-stone-200 bg-white px-4 py-4 sm:px-6">
      <div className="mx-auto flex max-w-3xl items-center justify-between">
        <span className="text-xs text-stone-400">Teachable Calculus Agent</span>

        <a
          href="https://github.com/nila-1234/calculus-teachable-agent"
          target="_blank"
          rel="noopener noreferrer"
          aria-label="View source on GitHub"
          className="flex h-8 w-8 items-center justify-center rounded-full text-stone-500 transition-colors hover:bg-stone-100 hover:text-stone-800"
        >
          <GitHubLogoIcon width={18} height={18} />
        </a>
      </div>
    </footer>
  );
}
