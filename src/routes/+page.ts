import type { PageLoad } from './$types';

// We can re-enable prerendering since we won't be using environment variables directly
export const prerender = true;

export const load: PageLoad = async () => {
  return {
    geminiApiKey: ''
  };
};
