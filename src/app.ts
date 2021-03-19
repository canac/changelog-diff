import 'dotenv/config';
import { graphql } from '@octokit/graphql';

const token = process.env.GITHUB_TOKEN;
if (!token) {
  throw new Error('No authentication token');
}

const graphqlWithAuth = graphql.defaults({
  headers: {
    authorization: `Bearer ${token}`,
  },
});

type QueryResponse = {
  viewer: {
    starredRepositories: {
      nodes: {
        nameWithOwner: string;
      }[];
      pageInfo: {
        endCursor: string;
        hasNextPage: boolean;
      };
    };
  };
};

async function* getRepos(): AsyncGenerator<string, void, undefined> {
  let page = '';
  while (true) {
    // eslint-disable-next-line no-await-in-loop
    const data: QueryResponse = await graphqlWithAuth(`query ($afterCursor: String!) {
        viewer {
          starredRepositories(after: $afterCursor) {
            nodes {
              nameWithOwner
            }
            pageInfo {
              endCursor
              hasNextPage
            }
          }
        }
      }`, {
      afterCursor: page,
    });
    const { nodes: repos, pageInfo } = data.viewer.starredRepositories;
    yield* repos.map((repo) => repo.nameWithOwner);

    if (!pageInfo.hasNextPage) {
      break;
    }

    page = pageInfo.endCursor;
  }
}

async function run() {
  // eslint-disable-next-line no-restricted-syntax
  for await (const repo of getRepos()) {
    console.log(repo);
  }
}

run().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
});
