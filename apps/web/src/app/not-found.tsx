import Link from 'next/link';
import { PageHero } from '@web/components/page-hero';

export default function NotFound() {
  return (
    <div className="space-y-8 py-8">
      <PageHero
        eyebrow="404"
        title="That page is not in the workshop"
        description="The content may have been moved, unpublished, or the link is incorrect. Use the category index to keep browsing evergreen guides."
        actions={
          <Link href="/categories" className="inline-flex rounded-full bg-coal px-5 py-3 text-sm font-medium text-paper hover:bg-coal/90">
            Browse categories
          </Link>
        }
      />
    </div>
  );
}
