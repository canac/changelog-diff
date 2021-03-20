import 'dotenv/config';
import { graphql } from '@octokit/graphql';
import { green, red } from 'chalk';
import { diffLines } from 'diff';
import { asyncForEach, asyncZip, repeat } from 'iter-tools';
import { readFile, writeFile } from 'jsonfile';

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

type ChangelogSnapshot = Record<string, string>;

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

const snapshotFile = 'snapshot.json';

async function loadSnapshot(): Promise<ChangelogSnapshot> {
  try {
    const snapshot = (await readFile(snapshotFile)) as ChangelogSnapshot;
    return snapshot;
  } catch (err: unknown) {
    if (err.code === 'ENOENT') {
      return {};
    }

    throw err;
  }
}

async function saveSnapshot(snapshot: ChangelogSnapshot): Promise<void> {
  await writeFile(snapshotFile, snapshot);
}

async function run() {
  const currentSnapshot: ChangelogSnapshot = Object.create(null) as ChangelogSnapshot;

  await asyncForEach(
    ([{ repo, content }, previousSnapshot]) => {
      currentSnapshot[repo] = content;

      const previousChangelog = previousSnapshot[repo] ?? '';
      const changes = diffLines(previousChangelog, content).filter(({ added, removed }) => added || removed);
      if (changes.length === 0) {
        return;
      }

      console.log(repo);
      console.log('----------');
      changes.forEach(({ value, added }) => {
        const color = added ? green : red;
        console.log(color(value));
      });
    },
    asyncZip(
      getChangelogs(),
      repeat(await loadSnapshot()),
    ),
  );

  await saveSnapshot(currentSnapshot);
}

run().catch((err) => {
  console.error(err);
});
