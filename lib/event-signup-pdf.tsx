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
  bodyRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#cccccc",
    minHeight: 26,
  },
  cellNumber: {
    width: 28,
    padding: 6,
    borderRightWidth: 1,
    borderRightColor: "#cccccc",
    textAlign: "center",
  },
  cellName: { flex: 2, padding: 6, borderRightWidth: 1, borderRightColor: "#cccccc" },
  cellContact: { flex: 2, padding: 6, borderRightWidth: 1, borderRightColor: "#cccccc" },
  cellHandicap: { flex: 1, padding: 6 },
  headerCellText: { fontSize: 10, fontWeight: "bold" },
  footer: { marginTop: 18, fontSize: 8, color: "#999999" },
});

// Capped independent of capacity — a genuinely large event (unlikely for
// a golf society, but not impossible) shouldn't produce an absurdly long
// printed page. 30 blank rows comfortably fits one A4 page alongside the
// header and QR code above it.
const MAX_BLANK_ROWS = 30;

export interface EventSignUpPdfProps {
  eventName: string;
  courseName: string;
  eventDateFormatted: string;
  firstTeeTimeFormatted: string;
  formatLabel: string;
  capacity: number;
  registeredCount: number;
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
  qrDataUrl,
  signUpUrl,
}: EventSignUpPdfProps) {
  const blankRows = Math.max(0, Math.min(capacity - registeredCount, MAX_BLANK_ROWS));

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
          </View>

          <View style={styles.qrBlock}>
            <Image src={qrDataUrl} style={{ width: 130, height: 130 }} />
            <Text style={styles.qrCaption}>Scan with your phone to sign up</Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Can&apos;t use the app? Sign up here:</Text>
        <Text style={styles.sectionSubtitle}>
          An admin will add you from this sheet — no need to do anything else.
        </Text>

        <View style={styles.table}>
          <View style={styles.headerRow}>
            <Text style={[styles.cellNumber, styles.headerCellText]}>#</Text>
            <Text style={[styles.cellName, styles.headerCellText]}>Name</Text>
            <Text style={[styles.cellContact, styles.headerCellText]}>Phone / email</Text>
            <Text style={[styles.cellHandicap, styles.headerCellText]}>Handicap</Text>
          </View>
          {Array.from({ length: blankRows }).map((_, i) => (
            <View style={styles.bodyRow} key={i}>
              {/* Continues the numbering from wherever app registrations
                  left off — spot 14 of 16 if 13 are already registered,
                  not 1 of 3 — since these rows represent specific
                  remaining spots at the event, not just "however many
                  blank rows happened to fit on the page". */}
              <Text style={styles.cellNumber}>{registeredCount + i + 1}</Text>
              <Text style={styles.cellName} />
              <Text style={styles.cellContact} />
              <Text style={styles.cellHandicap} />
            </View>
          ))}
        </View>

        <Text style={styles.footer}>{signUpUrl}</Text>
      </Page>
    </Document>
  );
}
