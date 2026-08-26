export async function POST(req: Request) {
  try {
    const formData = await req.formData();

    const file = formData.get("resume");

    if (!(file instanceof File)) {
      return Response.json(
        {
          success: false,
          error: "No resume file received",
        },
        {
          status: 400,
        }
      );
    }

    return Response.json({
      success: true,
      message: "Resume received successfully",
      file: {
        name: file.name,
        type: file.type,
        size: file.size,
      },
    });
  } catch (error: any) {
    return Response.json(
      {
        success: false,
        error: error?.message || "Upload failed",
      },
      {
        status: 500,
      }
    );
  }
}