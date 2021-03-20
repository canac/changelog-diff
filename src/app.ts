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
        content: {
          text: string;
        } | null;
      }[];
      pageInfo: {
        endCursor: string;
        hasNextPage: boolean;
      };
    };
  };
};

type Changelog = {
  repo: string;
  content: string;
}

async function* getChangelogs(): AsyncGenerator<Changelog, void, undefined> {
  let page = '';
  while (true) {
    // eslint-disable-next-line no-await-in-loop
    const data: QueryResponse = await graphqlWithAuth(`query ($afterCursor: String!) {
        viewer {
          starredRepositories(after: $afterCursor) {
            nodes {
              nameWithOwner
              content: object(expression: "HEAD:CHANGELOG.md") {
                ... on Blob {
                  text
                }
              }
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

    const changelogs: Array<Changelog> = repos.flatMap((repo): Changelog[] => {
      if (!repo.content) {
        return [];
      }

      return [{
        repo: repo.nameWithOwner,
        content: repo.content.text,
      }];
    });
    yield* changelogs;

    if (!pageInfo.hasNextPage) {
      break;
    }

    page = pageInfo.endCursor;
  }
}

async function run() {
  // eslint-disable-next-line no-restricted-syntax
  for await (const repo of getChangelogs()) {
    console.log(repo);
  }
}

run().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
});
