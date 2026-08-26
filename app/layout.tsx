export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN">
      <body
        style={{
          fontFamily: "Inter, Arial, sans-serif",
          margin: 0,
          background: "#f6f7f9",
        }}
      >
        {children}
      </body>
    </html>
  );
}
