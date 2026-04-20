export class User {
    private _id?: string;
    private _name?: string;
    private _email: string;
    private _hashedPassword: string;

    constructor();
    constructor(
        id: string,
        name: string,
        email: string,
        hashedPassword: string
    );

    constructor(
        id: string = "",
        name: string = "",
        email: string = "",
        hashedPassword: string = ""
    ) {
        this._id = id;
        this._name = name;
        this._email = email;
        this._hashedPassword = hashedPassword;
    }

    public get id(): string | undefined {
        return this._id;
    }

    
}