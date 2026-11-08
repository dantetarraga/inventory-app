/**
 * PDF rendering for reports. This module is imported lazily so @react-pdf/renderer
 * (large) is only downloaded when the user exports a PDF.
 */
import { Document, Page, pdf, StyleSheet, Text, View } from '@react-pdf/renderer';

export interface PdfColumn {
  header: string;
  key: string;
  /** Relative width (flex). */
  width?: number;
  align?: 'left' | 'right';
}

export interface PdfReport {
  title: string;
  subtitle?: string;
  company: string;
  columns: PdfColumn[];
  rows: Array<Record<string, string>>;
  footer?: Array<{ label: string; value: string }>;
  landscape?: boolean;
}

const styles = StyleSheet.create({
  page: { padding: 32, fontSize: 9, fontFamily: 'Helvetica', color: '#1f2937' },
  header: { marginBottom: 16, borderBottom: '2pt solid #4f46e5', paddingBottom: 8 },
  company: { fontSize: 10, color: '#4f46e5', fontFamily: 'Helvetica-Bold' },
  title: { fontSize: 16, fontFamily: 'Helvetica-Bold', marginTop: 4 },
  subtitle: { fontSize: 9, color: '#6b7280', marginTop: 2 },
  row: { flexDirection: 'row', borderBottom: '0.5pt solid #e5e7eb', paddingVertical: 4 },
  head: {
    flexDirection: 'row',
    backgroundColor: '#f3f4f6',
    paddingVertical: 5,
    fontFamily: 'Helvetica-Bold',
  },
  cell: { paddingHorizontal: 4 },
  footer: { marginTop: 12, alignItems: 'flex-end' },
  footerRow: { flexDirection: 'row', gap: 12, fontSize: 11 },
  pageNumber: { position: 'absolute', bottom: 16, right: 32, fontSize: 8, color: '#9ca3af' },
  generated: { position: 'absolute', bottom: 16, left: 32, fontSize: 8, color: '#9ca3af' },
});

function ReportDocument({ report }: { report: PdfReport }) {
  const cell = (c: PdfColumn) => [
    styles.cell,
    { flex: c.width ?? 1, textAlign: c.align ?? 'left' },
  ];
  return (
    <Document title={report.title} author={report.company} creator="StockPRO">
      <Page size="A4" orientation={report.landscape ? 'landscape' : 'portrait'} style={styles.page}>
        <View style={styles.header} fixed>
          <Text style={styles.company}>{report.company}</Text>
          <Text style={styles.title}>{report.title}</Text>
          {report.subtitle && <Text style={styles.subtitle}>{report.subtitle}</Text>}
        </View>
        <View style={styles.head} fixed>
          {report.columns.map((c) => (
            <Text key={c.key} style={cell(c)}>
              {c.header}
            </Text>
          ))}
        </View>
        {report.rows.map((r, i) => (
          <View key={i} style={styles.row} wrap={false}>
            {report.columns.map((c) => (
              <Text key={c.key} style={cell(c)}>
                {r[c.key] ?? ''}
              </Text>
            ))}
          </View>
        ))}
        {report.rows.length === 0 && (
          <Text style={{ marginTop: 12, color: '#6b7280' }}>Sin datos.</Text>
        )}
        {report.footer && (
          <View style={styles.footer}>
            {report.footer.map((f) => (
              <View key={f.label} style={styles.footerRow}>
                <Text>{f.label}</Text>
                <Text style={{ fontFamily: 'Helvetica-Bold' }}>{f.value}</Text>
              </View>
            ))}
          </View>
        )}
        <Text style={styles.generated} fixed>
          Generado el {new Date().toLocaleString('es-PE')}
        </Text>
        <Text
          style={styles.pageNumber}
          fixed
          render={({ pageNumber, totalPages }) => `Página ${pageNumber} de ${totalPages}`}
        />
      </Page>
    </Document>
  );
}

export async function downloadPdf(report: PdfReport, filename: string) {
  const blob = await pdf(<ReportDocument report={report} />).toBlob();
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement('a'), {
    href: url,
    download: `${filename}-${new Date().toISOString().slice(0, 10)}.pdf`,
  });
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
