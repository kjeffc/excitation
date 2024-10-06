import { useAtom } from "jotai";
import { stateAtom } from "./State";
import { useCallback, useMemo } from "react";
import { Action, Citation, Doc } from "./Types";
import { CitationUX } from "./Citation";
import {
  DocumentRegular,
  DocumentOnePageRegular,
  DocumentOnePageMultipleRegular,
  DocumentOnePageAddRegular,
} from "@fluentui/react-icons";

const maxPageNumber = 1000;
const unlocatedPage = maxPageNumber;

interface PageGroup {
  firstPage: number;
  lastPage: number;
  citationIndices: number[];
}

const sortIndex = ({ firstPage, lastPage }: PageGroup) =>
  firstPage * maxPageNumber + lastPage;

const sortCitation = (questionCitations: Citation[], citationIndex: number) => {
  const { review } = questionCitations[citationIndex];
  return review * 1000 + citationIndex;
};

const groupCitations = (docs: Doc[], questionCitations: Citation[]) =>
  docs.map((_, docIndex) => ({
    docIndex,
    pageGroups: questionCitations
      .map<[Citation, number[]]>((citation, citationIndex) => [
        citation,
        [citationIndex],
      ])
      .filter(([citation]) => citation.docIndex === docIndex)
      .map(([citation, citationIndices]) => {
        const pageNumbers = (
          citation.boundingRegions ?? [{ pageNumber: unlocatedPage }]
        )
          .map(({ pageNumber }) => pageNumber)
          .sort();
        return {
          firstPage: pageNumbers[0],
          lastPage: pageNumbers[pageNumbers.length - 1],
          citationIndices,
        };
      })
      .reduce((pageGroups, pageGroup) => {
        const matchingPageGroup = pageGroups.find(
          ({ firstPage, lastPage }) =>
            firstPage == pageGroup.firstPage && lastPage == pageGroup.lastPage
        );
        if (matchingPageGroup) {
          matchingPageGroup.citationIndices.push(pageGroup.citationIndices[0]);
        } else {
          pageGroups.push(pageGroup);
        }
        return pageGroups;
      }, [] as PageGroup[])
      .map(({ firstPage, lastPage, citationIndices }) => ({
        firstPage,
        lastPage,
        citationIndices: citationIndices.sort(
          (a, b) =>
            sortCitation(questionCitations, a) -
            sortCitation(questionCitations, b)
        ),
      }))
      .sort((a, b) => sortIndex(a) - sortIndex(b)),
  }));

export function Sidebar() {
  const [state, _dispatch] = useAtom(stateAtom);
  const {
    form: { docs, questions },
    citations,
    ux,
    asyncState,
  } = state;
  const { questionIndex, selectedCitation } = ux;

  const groupedCitations = useMemo(
    () => groupCitations(docs, citations[questionIndex]),
    [docs, citations, questionIndex]
  );

  const dispatch = useCallback(
    (action: Action) => () => _dispatch(action),
    [_dispatch]
  );

  const disablePrev = questionIndex === 0;
  const disableNext = questionIndex === questions.length - 1;

  const addSelection = useCallback(() => {
    _dispatch({ type: "addSelection" });
    document.getSelection()?.empty();
  }, [_dispatch]);

  return (
    <div id="sidebar">
      <div className="sidebar-header">
        <button
          disabled={disablePrev}
          onClick={dispatch({ type: "prevQuestion" })}
        >
          &lt;
        </button>
        <div className="q-number">Question #{questionIndex + 1}</div>
        <button
          disabled={disableNext}
          onClick={dispatch({ type: "nextQuestion" })}
        >
          &gt;
        </button>
      </div>
      <div className="question">{questions[questionIndex]}</div>
      <div>
        {groupedCitations.map(({ docIndex, pageGroups }) => (
          <div id="document-group" key={docIndex}>
            <div
              className="doc-header"
              onClick={
                docIndex == ux.docIndex
                  ? undefined
                  : dispatch({ type: "gotoDoc", docIndex })
              }
            >
              <DocumentRegular className="icon" />
              {docs[docIndex].friendlyname ?? docs[docIndex].filename}
            </div>
            {pageGroups.map(({ firstPage, lastPage, citationIndices }) => (
              <div
                className="page-group"
                key={firstPage * maxPageNumber + lastPage}
              >
                <div className="page-header">
                  {firstPage == lastPage ? (
                    firstPage == unlocatedPage ? (
                      <>
                        <DocumentOnePageAddRegular className="icon" />
                        Unable to locate citation
                      </>
                    ) : (
                      <>
                        <DocumentOnePageRegular className="icon" />
                        Page {firstPage}
                      </>
                    )
                  ) : (
                    <>
                      <DocumentOnePageMultipleRegular className="icon" />
                      Pages {firstPage}-{lastPage}
                    </>
                  )}
                </div>
                {citationIndices.map((citationIndex) => {
                  const { excerpt, review } =
                    citations[questionIndex][citationIndex];
                  return (
                    <CitationUX
                      key={citationIndex}
                      citationIndex={citationIndex}
                      excerpt={excerpt}
                      review={review}
                      selected={
                       selectedCitation?.citationIndex == citationIndex
                      }
                    />
                  );
                })}
              </div>
            ))}
          </div>
        ))}
        <br />
        &nbsp;
        <button
          onClick={addSelection}
          disabled={asyncState.status != "idle" || ux.range == undefined}
        >
          add selection
        </button>
        {asyncState.status == "error" && (
          <div>
            &nbsp;
            <button onClick={dispatch({ type: 'asyncRetry' })}>Retry</button>
            &nbsp;
            <button onClick={dispatch({ type: 'asyncRevert' })}>Revert</button>
          </div>
        )}
      </div>
    </div>
  );
}
