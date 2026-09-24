namespace ManaBandi.Api.Infrastructure;

/// <summary>An error with an HTTP status and one of the contract's problem `code` values.</summary>
public class ApiException : Exception
{
    public int Status { get; }
    public string Code { get; }

    public ApiException(int status, string code, string title) : base(title)
    {
        Status = status;
        Code = code;
    }

    public static ApiException NotFound(string what = "Not found") => new(404, "not_found", what);
    public static ApiException Validation(string title) => new(422, "validation", title);
    public static ApiException BadRequest(string title) => new(400, "validation", title);
    public static ApiException InvalidState(string title) => new(422, "invalid_state", title);
    public static ApiException Forbidden(string title = "You are not allowed to do this") => new(403, "forbidden", title);
}
