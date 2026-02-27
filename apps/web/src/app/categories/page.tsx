import type { Metadata } from 'next';
import { CategoryGrid } from '@web/components/category-grid';
import { PageHero } from '@web/components/page-hero';
import { getAllCategories } from '@web/lib/content';

export const metadata: Metadata = {
  title: 'Categories',
  description: 'Explore Home & DIY content clusters including organization, cleaning, maintenance, and beginner gardening.'
};

export default async function CategoriesIndexPage() {
  const categories = await getAllCategories();

  return (
    <div className="space-y-8 py-6">
      <PageHero
        eyebrow="Category Index"
        title="Evergreen content clusters"
        description="Each category is structured to support automated topic generation, internal linking, and scalable article publishing."
      />
      <CategoryGrid categories={categories} />
    </div>
  );
}
