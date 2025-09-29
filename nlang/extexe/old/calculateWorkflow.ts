export type WorkflowFile<T> = {
  hasChanges: boolean;
  dependencies?: string[];
  file?: T;
};

/** Effiently finds all items that it must run in parallel to ensure nothing becomes stale in the end, while not getting caught in any loops. */
export const calculateWorkflow = <T>(files: {
  [path: string]: WorkflowFile<T>;
}) => {
  const workflow: string[][] = [];
  //console.log(`start: ${Object.keys(files).length} files`);
  while (true) {
    const remove = Object.keys(files).filter((path) => {
      return (
        // has no dependencies or deps dont exist (anymore)
        !files[path].dependencies?.length
      );
    });

    const changes = remove.filter((path) => {
      // has changes
      return files[path].hasChanges;
    });

    remove.map((path) => {
      delete files[path];
    });

    Object.keys(files).map((path) => {
      if (files[path].dependencies?.find((d) => changes.find((x) => x === d))) {
        // all changes files turn its dependants stale
        files[path].hasChanges = true;
      }

      // all removed items cannot be dependencies anymore
      files[path].dependencies = files[path].dependencies?.filter(
        (x) => !remove.includes(x),
      );
    });

    if (remove.length === 0) {
      // basecase
      // console.log("nothing removed. end loop.");
      const hasFilesLeft = Object.keys(files).length > 0;
      return {
        workflow,
        unprocessedPaths: hasFilesLeft ? Object.keys(files) : undefined,
      };
    }
    // console.log(
    //   `remove=${remove.join(",")}, changes=${changes.join(",")}, ${
    //     Object.keys(files).length
    //   } files left`,
    // );

    if (changes.length) {
      workflow.push(changes);
    }
  }
};
