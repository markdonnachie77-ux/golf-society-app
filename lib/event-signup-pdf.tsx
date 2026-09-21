import * as React from "react";
import { Document, Page, View, Text, Image, StyleSheet } from "@react-pdf/renderer";

const styles = StyleSheet.create({
  page: { padding: 48, fontSize: 11, color: "#1a1a1a" },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 28,
  },
  eventName: { fontSize: 22, fontWeight: "bold", marginBottom: 14 },
  detailRow: { flexDirection: "row", marginBottom: 4 },
  detailLabel: { width: 90, color: "#555" },
  detailValue: { fontWeight: "bold" },
  qrBlock: { alignItems: "center" },
  qrCaption: { fontSize: 9, marginTop: 6, color: "#555", textAlign: "center", width: 130 },
  sectionTitle: { fontSize: 13, fontWeight: "bold", marginTop: 12, marginBottom: 8 },
  sectionSubtitle: { fontSize: 9, color: "#555", marginBottom: 10 },
  table: { borderTopWidth: 1, borderTopColor: "#333" },
  headerRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#333",
    backgroundColor: "#eeeeee",
    paddingVertical: 6,
  },
  bodyRowBase: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#cccccc",
  },
  cellNumberBase: {
    width: 28,
    borderRightWidth: 1,
    borderRightColor: "#cccccc",
    textAlign: "center",
  },
  cellNameBase: { flex: 2, borderRightWidth: 1, borderRightColor: "#cccccc" },
  cellNameOnlyBase: { flex: 1, borderRightWidth: 1, borderRightColor: "#cccccc" },
  cellHandicapColBase: { width: 64, textAlign: "center" },
  cellContactBase: { flex: 2, borderRightWidth: 1, borderRightColor: "#cccccc" },
  cellHandicapBase: { flex: 1 },
  headerCellText: { fontSize: 10, fontWeight: "bold" },
  footer: { marginTop: 18, fontSize: 8, color: "#999999" },
});

/**
 * Row height, cell padding, and body-cell font size all scale down
 * together above ROWS_FITTING_AT_MAX_SIZE, rather than just shrinking
 * row height alone — which would leave text overflowing a now-shorter
 * row, since padding and font size would still be sized for the taller
 * default. Scaling all three by the same factor keeps the same
 * proportions (padding : text-space : row-height) at any size, all the
 * way down to a legibility floor beyond which rows simply stop shrinking
 * further — a hand-write box has to stay usably sized even if that means
 * a very large event's sheet can no longer guarantee a single page.
 *
 * ROWS_FITTING_AT_MAX_SIZE=13 is empirically measured, not estimated:
 * rendered real PDFs at increasing total row counts (registered shown +
 * blank shown, combined across both tables — that's the right total,
 * since both tables share the same page) and counted actual pages via
 * pdf-lib. 13 total rows fits on one A4 page at the original fixed
 * sizing (26pt row height, 6pt padding, 11pt font) in every case tested
 * — short names, long/wrapping names, and all-registered-zero-blank.
 * 14 tips to a second page in every case. If this template's other
 * content (header size, section text, margins) ever changes materially,
 * this number should be re-measured the same way, not adjusted by guess.
 */
const MAX_ROW_HEIGHT = 26;
const MIN_ROW_HEIGHT = 14;
const MAX_ROW_PADDING = 6;
const MIN_ROW_PADDING = 3;
const MAX_ROW_FONT_SIZE = 11;
const MIN_ROW_FONT_SIZE = 8;
const ROWS_FITTING_AT_MAX_SIZE = 13;

interface RowSizing {
  minHeight: number;
  padding: number;
  fontSize: number;
}

function computeRowSizing(totalRows: number): RowSizing {
  if (totalRows <= ROWS_FITTING_AT_MAX_SIZE) {
    return { minHeight: MAX_ROW_HEIGHT, padding: MAX_ROW_PADDING, fontSize: MAX_ROW_FONT_SIZE };
  }
  const scale = ROWS_FITTING_AT_MAX_SIZE / totalRows;
  return {
    minHeight: Math.max(MIN_ROW_HEIGHT, MAX_ROW_HEIGHT * scale),
    padding: Math.max(MIN_ROW_PADDING, MAX_ROW_PADDING * scale),
    fontSize: Math.max(MIN_ROW_FONT_SIZE, MAX_ROW_FONT_SIZE * scale),
  };
}

// Independent of the scaling above, but for the same underlying reason:
// MIN_ROW_HEIGHT is a legibility floor rows can't shrink past, which
// means the "always fits on one page" guarantee has its own ceiling —
// past a certain total, even minimum-height rows don't fit. Empirically
// measured against the ACTUAL scaling implementation above (not derived
// by calculation): 21 total rows fits on one page in every case tested
// (short names, long/wrapping names, all-registered/zero-blank), 22
// tips to a second page in every case. A genuinely extreme capacity (the
// app allows up to 500) still gets a hard ceiling here — blank rows give
// way first when the total would exceed this, since already-registered
// names always all get shown. If this template's other content changes
// materially, this number should be re-measured the same way, not
// adjusted by guess.
//
// Was 22 before the optional deposit/balance header rows were added —
// re-measured (not adjusted by estimate) once those rows existed, since
// they reduce the space available to the tables below whenever an event
// has both set: 22 total rows, which fit safely before, tips to a
// second page once that header grows by its full two extra lines. 21 is
// the new, correct ceiling that holds in every case, including the
// still-common case of an event with neither field set — the ceiling
// has to cover the worst case regardless of whether any specific event
// happens to use these fields, not just the common one.
const MAX_TOTAL_ROWS = 21;

export interface EventSignUpPdfProps {
  eventName: string;
  courseName: string;
  eventDateFormatted: string;
  firstTeeTimeFormatted: string;
  formatLabel: string;
  capacity: number;
  registeredCount: number;
  registeredPlayers: { name: string; handicapDisplay: string }[];
  handicapColumnLabel: string;
  depositGbpFormatted: string | null;
  remainingBalanceGbpFormatted: string | null;
  qrDataUrl: string;
  signUpUrl: string;
}

/**
 * The number of hand-write rows is deliberately capacity minus however
 * many have already registered through the app, not the full capacity —
 * this sheet exists for people who CAN'T use the app, so rows for spots
 * already filled by app registrations would be misleading (implying more
 * room than actually remains) as well as wasted space on a printed page
 * that's meant to sit on a physical noticeboard, not be reprinted daily.
 */
export function EventSignUpPdf({
  eventName,
  courseName,
  eventDateFormatted,
  firstTeeTimeFormatted,
  formatLabel,
  capacity,
  registeredCount,
  registeredPlayers,
  handicapColumnLabel,
  depositGbpFormatted,
  remainingBalanceGbpFormatted,
  qrDataUrl,
  signUpUrl,
}: EventSignUpPdfProps) {
  const rawBlankRows = Math.max(0, capacity - registeredCount);
  const totalRowsUncapped = registeredPlayers.length + rawBlankRows;
  // Both tables share the same scaling and the same overall row budget —
  // if the total would exceed MAX_TOTAL_ROWS, blank rows give way first
  // (already-registered names always all get shown; it's the hand-write
  // rows for people who haven't signed up yet that get trimmed).
  const blankRows = Math.max(0, Math.min(rawBlankRows, MAX_TOTAL_ROWS - registeredPlayers.length));
  const totalRows = registeredPlayers.length + blankRows;

  const sizing = computeRowSizing(totalRows);
  const bodyRow = { ...styles.bodyRowBase, minHeight: sizing.minHeight };
  const cellNumber = { ...styles.cellNumberBase, padding: sizing.padding, fontSize: sizing.fontSize };
  const cellName = { ...styles.cellNameBase, padding: sizing.padding, fontSize: sizing.fontSize };
  const cellNameOnly = { ...styles.cellNameOnlyBase, padding: sizing.padding, fontSize: sizing.fontSize };
  const cellContact = { ...styles.cellContactBase, padding: sizing.padding, fontSize: sizing.fontSize };
  const cellHandicap = { ...styles.cellHandicapBase, padding: sizing.padding, fontSize: sizing.fontSize };
  const cellHandicapCol = {
    ...styles.cellHandicapColBase,
    padding: sizing.padding,
    fontSize: sizing.fontSize,
  };

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <View>
            <Text style={styles.eventName}>{eventName}</Text>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Course</Text>
              <Text style={styles.detailValue}>{courseName}</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Date</Text>
              <Text style={styles.detailValue}>{eventDateFormatted}</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>First tee</Text>
              <Text style={styles.detailValue}>{firstTeeTimeFormatted}</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Format</Text>
              <Text style={styles.detailValue}>{formatLabel}</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Spaces</Text>
              <Text style={styles.detailValue}>
                {registeredCount} / {capacity} filled
              </Text>
            </View>
            {depositGbpFormatted !== null && (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Deposit</Text>
                <Text style={styles.detailValue}>{depositGbpFormatted}</Text>
              </View>
            )}
            {remainingBalanceGbpFormatted !== null && (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Balance</Text>
                <Text style={styles.detailValue}>{remainingBalanceGbpFormatted}</Text>
              </View>
            )}
          </View>

          <View style={styles.qrBlock}>
            <Image src={qrDataUrl} style={{ width: 130, height: 130 }} />
            <Text style={styles.qrCaption}>Scan with your phone to sign up</Text>
          </View>
        </View>

        {registeredPlayers.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Already signed up:</Text>
            <View style={[styles.table, { marginBottom: 20 }]}>
              <View style={styles.headerRow}>
                <Text style={[cellNumber, styles.headerCellText]}>#</Text>
                <Text style={[cellNameOnly, styles.headerCellText]}>Name</Text>
                <Text style={[cellHandicapCol, styles.headerCellText]}>{handicapColumnLabel}</Text>
              </View>
              {registeredPlayers.map((p, i) => (
                <View style={bodyRow} key={i}>
                  <Text style={cellNumber}>{i + 1}</Text>
                  <Text style={cellNameOnly}>{p.name}</Text>
                  <Text style={cellHandicapCol}>{p.handicapDisplay}</Text>
                </View>
              ))}
            </View>
          </>
        )}

        <Text style={styles.sectionTitle}>Can&apos;t use the app? Sign up here:</Text>
        <Text style={styles.sectionSubtitle}>
          An admin will add you from this sheet — no need to do anything else.
        </Text>

        <View style={styles.table}>
          <View style={styles.headerRow}>
            <Text style={[cellNumber, styles.headerCellText]}>#</Text>
            <Text style={[cellName, styles.headerCellText]}>Name</Text>
            <Text style={[cellContact, styles.headerCellText]}>Phone / email</Text>
            <Text style={[cellHandicap, styles.headerCellText]}>Handicap</Text>
          </View>
          {Array.from({ length: blankRows }).map((_, i) => (
            <View style={bodyRow} key={i}>
              {/* Continues the numbering from wherever app registrations
                  left off — spot 14 of 16 if 13 are already registered,
                  not 1 of 3 — since these rows represent specific
                  remaining spots at the event, not just "however many
                  blank rows happened to fit on the page". */}
              <Text style={cellNumber}>{registeredCount + i + 1}</Text>
              <Text style={cellName} />
              <Text style={cellContact} />
              <Text style={cellHandicap} />
            </View>
          ))}
        </View>

        <Text style={styles.footer}>{signUpUrl}</Text>
      </Page>
    </Document>
  );
}
